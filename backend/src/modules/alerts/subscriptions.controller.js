// src/modules/alerts/subscriptions.controller.js
// Section 103 alert subscription endpoints. Section 40: 201 on create.

const service = require('./subscriptions.service');
const asyncHandler = require('../../utils/asyncHandler');
const { HTTP } = require('../../errors/httpStatus');

function toIso(value) {
  return value instanceof Date ? value.toISOString() : value;
}

/**
 * Project onto contracts/api/AlertSubscriptionResponse.json exactly.
 *   required: subscription_id, subscriber_id, location, alert_types,
 *             minimum_level, channel, created_at
 *   optional: activity, vessel_type, language_override, quiet_hours, updated_at
 * additionalProperties: false.
 *
 * push_subscription is deliberately NOT returned: it carries the auth and
 * p256dh keys, which are credentials (Section 107). The contract has no
 * has_push_subscription flag either, so we do not invent one.
 */
function present(subscription) {
  const object = subscription.toObject ? subscription.toObject() : subscription;

  // location is now the place_or_coordinate object as stored - not
  // reconstructed from flat lat/lon.
  const response = {
    subscription_id: object.subscription_id,
    subscriber_id: object.subscriber_id,
    location: object.location,
    alert_types: object.alert_types || [],
    minimum_level: object.minimum_level,
    channel: object.channel,
    created_at: toIso(object.created_at),
  };

  if (object.activity) response.activity = object.activity;
  if (object.vessel_type) response.vessel_type = object.vessel_type;
  if (object.language_override) response.language_override = object.language_override;
  if (object.quiet_hours) response.quiet_hours = object.quiet_hours;
  if (object.updated_at) response.updated_at = toIso(object.updated_at);

  return response;
}

const createSubscription = asyncHandler(async (req, res) => {
  const subscription = await service.createSubscription(req.body, req.user?.user_id || null);
  // Section 40: 201 Created - a subscription is created SYNCHRONOUSLY, unlike
  // an analysis.
  return res.status(HTTP.CREATED).json(present(subscription));
});

const getSubscription = asyncHandler(async (req, res) => {
  const subscription = await service.getSubscription(req.params.id);
  return res.status(HTTP.OK).json(present(subscription));
});

const updateSubscription = asyncHandler(async (req, res) => {
  const subscription = await service.updateSubscription(req.params.id, req.body);
  return res.status(HTTP.OK).json(present(subscription));
});

const deleteSubscription = asyncHandler(async (req, res) => {
  const subscription = await service.deleteSubscription(req.params.id);
  // Soft delete - alert_events reference this subscription and hard-deleting
  // would orphan the audit trail proving which warnings were sent.
  return res.status(HTTP.OK).json({
    subscription_id: subscription.subscription_id,
    active: subscription.active,
    message: 'Subscription deactivated. Historical alert events are retained for audit.',
  });
});

const getEvents = asyncHandler(async (req, res) => {
  const events = await service.getSubscriptionEvents(req.params.id);
  return res.status(HTTP.OK).json({ events });
});

module.exports = { createSubscription, getSubscription, updateSubscription, deleteSubscription, getEvents };
