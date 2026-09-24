/**
 * @fileoverview Subscriptions Service
 * Manages the lifecycle of alert subscriptions, validating complex geometries,
 * quiet hours, and alerting thresholds.
 *
 * @module alerts.subscriptions.service
 */

// src/modules/alerts/subscriptions.service.js
// ---------------------------------------------------------------------------
// Section 103 alert subscription CRUD. Section 40: 201 on create, 409 on
// duplicate.
//
// DELETE is a SOFT delete (active=false), not a hard one - alert_events
// reference the subscription, and hard-deleting would orphan the audit trail
// proving which warnings were sent.
//
// location uses contracts/AnalysisRequest.json's place_or_coordinate shape:
// { place_name?, coordinate?: {lat,lon} } - not a flat object.
// ---------------------------------------------------------------------------

const AlertSubscription = require('../../db/models/alertSubscription.model');
const { ALERT_TYPES, CHANNELS, RISK_LEVELS } = require('../../db/models/alertSubscription.model');
const { checkPlaceOrCoordinate } = require('../analysis/analysis.validator');
const { generatePrefixedId } = require('../../utils/ids');
const { AppError, ERROR_CATEGORIES } = require('../../errors/errorCategories');
const { HTTP } = require('../../errors/httpStatus');
const registry = require('../../config/registry');

// A subscriber cannot sensibly set minimum_level to SAFE - you are never
// alerted when everything is fine. The contract's own enum only offers
// CAUTION/UNSAFE/DANGEROUS for this field.
const MINIMUM_LEVEL_VALUES = ['CAUTION', 'UNSAFE', 'DANGEROUS'];

function validateSubscriptionBody(body, { partial = false } = {}) {
  const errors = [];

  if (!partial) {
    if (!body.subscriber_id || typeof body.subscriber_id !== 'string') {
      errors.push({ field: 'subscriber_id', message: 'subscriber_id is required.' });
    }
    if (!body.channel) {
      errors.push({ field: 'channel', message: 'channel is required.' });
    }
    if (!Array.isArray(body.alert_types) || body.alert_types.length === 0) {
      errors.push({ field: 'alert_types', message: 'alert_types is required and must contain at least one type.' });
    }
    if (!body.minimum_level) {
      errors.push({ field: 'minimum_level', message: 'minimum_level is required.' });
    }
  }

  if (!partial || body.location !== undefined) {
    if (!body.location) {
      errors.push({ field: 'location', message: 'location is required.' });
    } else {
      // location is a place_or_coordinate object, same shape validated
      // elsewhere for AnalysisRequest.origin/destination.
      const category = checkPlaceOrCoordinate(body.location, 'location', errors);
      if (category) { /* surfaced via errors array */ }
    }
  }

  if (body.activity !== undefined && body.activity !== null && !registry.isValidActivity(body.activity)) {
    errors.push({ field: 'activity', message: `Unknown activity "${body.activity}".` });
  }
  if (body.vessel_type !== undefined && body.vessel_type !== null && !registry.isValidVesselType(body.vessel_type)) {
    errors.push({ field: 'vessel_type', message: `Unknown vessel_type "${body.vessel_type}".` });
  }
  if (body.language_override !== undefined && body.language_override !== null && !registry.isValidLanguage(body.language_override)) {
    errors.push({ field: 'language_override', message: `Unsupported language "${body.language_override}".` });
  }

  if (body.alert_types !== undefined) {
    if (!Array.isArray(body.alert_types)) {
      errors.push({ field: 'alert_types', message: 'alert_types must be an array.' });
    } else {
      const invalid = body.alert_types.filter((t) => !ALERT_TYPES.includes(t));
      if (invalid.length) {
        errors.push({
          field: 'alert_types',
          message: `Unknown alert types: ${invalid.join(', ')}. Valid: ${ALERT_TYPES.join(', ')}.`,
        });
      }
    }
  }

  if (body.channel !== undefined && !CHANNELS.includes(body.channel)) {
    errors.push({ field: 'channel', message: `Unknown channel. Valid: ${CHANNELS.join(', ')}.` });
  }

  // UPPERCASE per contracts/api/AlertSubscriptionRequest.json. A lowercase
  // value here is the exact mistake this reconciliation fixes.
  if (body.minimum_level !== undefined && body.minimum_level !== null && !MINIMUM_LEVEL_VALUES.includes(body.minimum_level)) {
    errors.push({
      field: 'minimum_level',
      message: `minimum_level must be one of: ${MINIMUM_LEVEL_VALUES.join(', ')} (uppercase).`,
    });
  }

  if (body.quiet_hours !== undefined && body.quiet_hours !== null) {
    if (typeof body.quiet_hours !== 'object' || Array.isArray(body.quiet_hours)) {
      errors.push({ field: 'quiet_hours', message: 'quiet_hours must be an object { start, end }.' });
    }
  }

  return { valid: errors.length === 0, errors };
}

async function createSubscription(body, userId = null) {
  const validation = validateSubscriptionBody(body);
  if (!validation.valid) {
    throw new AppError('Subscription validation failed.', ERROR_CATEGORIES.VALIDATION_FAILURE, {
      violations: validation.errors,
    });
  }

  const subscription = new AlertSubscription({
    subscription_id: generatePrefixedId('sub'),
    subscriber_id: body.subscriber_id || userId,
    location: body.location,
    activity: body.activity || null,
    vessel_type: body.vessel_type || null,
    language_override: body.language_override || null,
    alert_types: body.alert_types,
    minimum_level: body.minimum_level,
    channel: body.channel,
    push_subscription: body.push_subscription || null,
    quiet_hours: body.quiet_hours || {},
    active: true,
  });

  try {
    await subscription.save();
    return subscription;
  } catch (err) {
    if (err.code === 11000) {
      const error = new AppError(
        'An active subscription already exists for this subscriber at this location.',
        ERROR_CATEGORIES.VALIDATION_FAILURE
      );
      error.httpStatusOverride = HTTP.CONFLICT;
      throw error;
    }
    throw err;
  }
}

async function getSubscription(subscriptionId) {
  const subscription = await AlertSubscription.findOne({ subscription_id: subscriptionId }).lean();
  if (!subscription) {
    const error = new AppError(`Subscription ${subscriptionId} was not found.`, ERROR_CATEGORIES.INTERNAL_ERROR);
    error.httpStatusOverride = HTTP.NOT_FOUND;
    throw error;
  }
  return subscription;
}

async function updateSubscription(subscriptionId, body) {
  const validation = validateSubscriptionBody(body, { partial: true });
  if (!validation.valid) {
    throw new AppError('Subscription update validation failed.', ERROR_CATEGORIES.VALIDATION_FAILURE, {
      violations: validation.errors,
    });
  }

  const subscription = await AlertSubscription.findOne({ subscription_id: subscriptionId });
  if (!subscription) {
    const error = new AppError(`Subscription ${subscriptionId} was not found.`, ERROR_CATEGORIES.INTERNAL_ERROR);
    error.httpStatusOverride = HTTP.NOT_FOUND;
    throw error;
  }

  // PATCH semantics: a field not supplied means "leave unchanged".
  if (body.location !== undefined) subscription.location = body.location;
  if (body.activity !== undefined) subscription.activity = body.activity;
  if (body.vessel_type !== undefined) subscription.vessel_type = body.vessel_type;
  if (body.language_override !== undefined) subscription.language_override = body.language_override;
  if (body.alert_types !== undefined) subscription.alert_types = body.alert_types;
  if (body.minimum_level !== undefined) subscription.minimum_level = body.minimum_level;
  if (body.channel !== undefined) subscription.channel = body.channel;
  if (body.quiet_hours !== undefined) subscription.quiet_hours = body.quiet_hours;
  if (body.active !== undefined) subscription.active = body.active;

  await subscription.save();
  return subscription;
}

async function deleteSubscription(subscriptionId) {
  const subscription = await AlertSubscription.findOneAndUpdate(
    { subscription_id: subscriptionId },
    { active: false },
    { new: true }
  );
  if (!subscription) {
    const error = new AppError(`Subscription ${subscriptionId} was not found.`, ERROR_CATEGORIES.INTERNAL_ERROR);
    error.httpStatusOverride = HTTP.NOT_FOUND;
    throw error;
  }
  return subscription;
}

async function getSubscriptionEvents(subscriptionId) {
  const AlertEvent = require('../../db/models/alertEvent.model');
  const events = await AlertEvent.find({ subscription_id: subscriptionId })
    .sort({ created_at: -1 })
    .limit(50)
    .lean();

  return events.map((ev) => ({
    event_id: ev._id ? ev._id.toString() : ev.event_id,
    alert_type: ev.alert_type,
    level: ev.level,
    message_text: ev.message_text,
    language: ev.language,
    channel: ev.channel,
    status: ev.status,
    delivered: ev.status === 'sent',
    delivery_error: ev.delivery_error,
    created_at: ev.created_at ? (ev.created_at.toISOString ? ev.created_at.toISOString() : ev.created_at) : null,
  }));
}

module.exports = {
  createSubscription,
  getSubscription,
  updateSubscription,
  deleteSubscription,
  getSubscriptionEvents,
  validateSubscriptionBody,
  MINIMUM_LEVEL_VALUES,
};
