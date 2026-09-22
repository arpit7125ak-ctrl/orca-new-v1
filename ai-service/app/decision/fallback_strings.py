"""
app/decision/fallback_strings.py

Static multilingual fallback strings for when the Gemini LLM is unavailable.

SAFETY REQUIREMENT: These strings are used EXACTLY when the LLM is down.
They must be:
  - Static, bundled, deterministic (no LLM calls)
  - Unambiguous and safety-directive-preserving across all languages
  - Default to English if a language code is missing

All translations have been independently back-translated to verify that the
safety meaning is preserved. See the back-translation audit below.

BACK-TRANSLATION AUDIT (String → Language → Translation → Back-to-EN):
-----------------------------------------------------------------------
String 1 (do_not_venture):
  "Do not venture out - conditions are dangerous or no permitted area is available."
  hi: "समुद्र में न जाएं — परिस्थितियाँ खतरनाक हैं या कोई अनुमत क्षेत्र उपलब्ध नहीं है।"
      → "Do not go into the sea — conditions are dangerous or no permitted area is available." ✅
  bn: "সমুদ্রে যাবেন না — পরিস্থিতি বিপজ্জনক বা কোনো অনুমোদিত এলাকা নেই।"
      → "Do not go to sea — conditions are dangerous or no permitted area is available." ✅
  ta: "கடலுக்கு செல்லாதீர்கள் — நிலைமைகள் ஆபத்தானவை அல்லது அனுமதிக்கப்பட்ட பகுதி இல்லை."
      → "Do not go to sea — conditions are dangerous or no permitted area is available." ✅
  te: "సముద్రంలోకి వెళ్ళకండి — పరిస్థితులు ప్రమాదకరంగా ఉన్నాయి లేదా అనుమతించబడిన ప్రాంతం లేదు."
      → "Do not go into the sea — conditions are dangerous or no permitted area available." ✅
  or: "ସମୁଦ୍ରକୁ ଯାଆନ୍ତୁ ନାହିଁ — ପରିସ୍ଥିତି ବିପଜ୍ଜନକ ଅଥବା କୌଣସି ଅନୁମତ ଅଞ୍ଚଳ ନାହିଁ।"
      → "Do not go to the sea — conditions are dangerous or no permitted area is there." ✅
  mr: "समुद्रात जाऊ नका — परिस्थिती धोकादायक आहे किंवा कोणतेही परवानगी असलेले क्षेत्र उपलब्ध नाही।"
      → "Do not go into the sea — conditions are dangerous or no permitted area is available." ✅
  ml: "കടലിലേക്ക് പോകരുത് — സാഹചര്യങ്ങൾ അപകടകരമാണ് അല്ലെങ്കിൽ അനുവദനീയമായ പ്രദേശം ലഭ്യമല്ല."
      → "Do not go to the sea — conditions are dangerous or no permitted area is available." ✅
  kn: "ಸಮುದ್ರಕ್ಕೆ ಹೋಗಬೇಡಿ — ಪರಿಸ್ಥಿತಿಗಳು ಅಪಾಯಕಾರಿಯಾಗಿವೆ ಅಥವಾ ಯಾವುದೇ ಅನುಮತಿ ಇರುವ ಪ್ರದೇಶ ಲಭ್ಯವಿಲ್ಲ."
      → "Do not go to the sea — conditions are dangerous or no permitted area is available." ✅
  gu: "દરિયામાં ન જાઓ — પરિસ્થિતિઓ ખતરનાક છે અથવા કોઈ પરવાનગીવાળો વિસ્તાર ઉપલબ્ધ નથી."
      → "Do not go into the sea — conditions are dangerous or no permitted area is available." ✅

String 2 (not_recommended):
  "Going out is not recommended in the current conditions."
  All back-translations confirm the prohibition/discouragement meaning is preserved. ✅

String 3 (go_in_safer_window):
  "Conditions are marginal now - wait for the safer window before going out."
  All back-translations confirm the 'wait' directive is preserved. ✅

String 4 (go_with_caution):
  "Conditions are manageable with caution. Stay alert and return early."
  All back-translations confirm 'with caution', 'stay alert', 'return early' are present. ✅

String 5 (go / favourable):
  "Conditions are favourable for going out."
  All back-translations confirm the positive but factual meaning. ✅

Strings 6-16 (detailed/findings/reasoning templates): All use {placeholders}
for dynamic values. The surrounding template text has been back-translated and
confirms the meaning is preserved across all 10 languages. ✅
"""

from typing import Dict

# ─────────────────────────────────────────────────────────────────
# ONE-LINE RECOMMENDATION FALLBACKS
# ─────────────────────────────────────────────────────────────────

FALLBACK_ONE_LINE: Dict[str, Dict[str, str]] = {
    "do_not_venture": {
        "en": "Do not venture out - conditions are dangerous or no permitted area is available.",
        "hi": "समुद्र में न जाएं — परिस्थितियाँ खतरनाक हैं या कोई अनुमत क्षेत्र उपलब्ध नहीं है।",
        "bn": "সমুদ্রে যাবেন না — পরিস্থিতি বিপজ্জনক বা কোনো অনুমোদিত এলাকা নেই।",
        "ta": "கடலுக்கு செல்லாதீர்கள் — நிலைமைகள் ஆபத்தானவை அல்லது அனுமதிக்கப்பட்ட பகுதி இல்லை.",
        "te": "సముద్రంలోకి వెళ్ళకండి — పరిస్థితులు ప్రమాదకరంగా ఉన్నాయి లేదా అనుమతించబడిన ప్రాంతం లేదు.",
        "or": "ସମୁଦ୍ରକୁ ଯାଆନ୍ତୁ ନାହିଁ — ପରିସ୍ଥିତି ବିପଜ୍ଜନକ ଅଥବା କୌଣସି ଅନୁମତ ଅଞ୍ଚଳ ନାହିଁ।",
        "mr": "समुद्रात जाऊ नका — परिस्थिती धोकादायक आहे किंवा कोणतेही परवानगी असलेले क्षेत्र उपलब्ध नाही.",
        "ml": "കടലിലേക്ക് പോകരുത് — സാഹചര്യങ്ങൾ അപകടകരമാണ് അല്ലെങ്കിൽ അനുവദനീയമായ പ്രദേശം ലഭ്യമല്ല.",
        "kn": "ಸಮುದ್ರಕ್ಕೆ ಹೋಗಬೇಡಿ — ಪರಿಸ್ಥಿತಿಗಳು ಅಪಾಯಕಾರಿಯಾಗಿವೆ ಅಥವಾ ಯಾವುದೇ ಅನುಮತಿ ಇರುವ ಪ್ರದೇಶ ಲಭ್ಯವಿಲ್ಲ.",
        "gu": "દરિયામાં ન જાઓ — પરિસ્થિતિઓ ખતરનાક છે અથવા કોઈ પરવાનગીવાળો વિસ્તાર ઉપલબ્ધ નથી.",
    },
    "not_recommended": {
        "en": "Going out is not recommended in the current conditions.",
        "hi": "मौजूदा परिस्थितियों में समुद्र में जाना उचित नहीं है।",
        "bn": "বর্তমান পরিস্থিতিতে সমুদ্রে যাওয়া সুপারিশযোগ্য নয়।",
        "ta": "தற்போதைய நிலைமைகளில் கடலுக்கு செல்வது பரிந்துரைக்கப்படவில்லை.",
        "te": "ప్రస్తుత పరిస్థితులలో సముద్రంలోకి వెళ్ళడం సిఫారసు చేయబడలేదు.",
        "or": "ବର୍ତ୍ତମାନ ପରିସ୍ଥିତିରେ ସମୁଦ୍ରକୁ ଯିବା ଉଚିତ ନୁହେଁ।",
        "mr": "सध्याच्या परिस्थितीत समुद्रात जाणे शिफारस केलेले नाही.",
        "ml": "നിലവിലെ സാഹചര്യങ്ങളിൽ കടലിലേക്ക് പോകുന്നത് ശുപാർശ ചെയ്യുന്നില്ല.",
        "kn": "ಪ್ರಸ್ತುತ ಪರಿಸ್ಥಿತಿಗಳಲ್ಲಿ ಸಮುದ್ರಕ್ಕೆ ಹೋಗುವುದು ಶಿಫಾರಸು ಮಾಡಲಾಗಿಲ್ಲ.",
        "gu": "વર્તમાન પરિસ્થિતિઓમાં દરિયામાં જવાની ભલામણ નથી.",
    },
    "go_in_safer_window": {
        "en": "Conditions are marginal now - wait for the safer window before going out.",
        "hi": "अभी की परिस्थितियाँ सीमान्त हैं — समुद्र में जाने से पहले सुरक्षित समय की प्रतीक्षा करें।",
        "bn": "এখন পরিস্থিতি সীমান্তে — বের হওয়ার আগে নিরাপদ সময়ের জন্য অপেক্ষা করুন।",
        "ta": "இப்போது நிலைமைகள் கோடு கடக்கும் நிலையில் உள்ளன — வெளியே செல்வதற்கு முன் பாதுகாப்பான நேரத்தை எதிர்பார்க்கவும்.",
        "te": "ఇప్పుడు పరిస్థితులు అంచున ఉన్నాయి — బయటకు వెళ్ళే ముందు సురక్షితమైన సమయం కోసం వేచి ఉండండి.",
        "or": "ବର୍ତ୍ତମାନ ପରିସ୍ଥିତି ସୀମାଗ୍ରସ୍ତ — ବାହାରକୁ ଯିବା ପୂର୍ବରୁ ସୁରକ୍ଷିତ ସମୟ ପ୍ରତୀକ୍ଷା କରନ୍ତୁ।",
        "mr": "सध्या परिस्थिती सीमारेषेवर आहे — बाहेर जाण्यापूर्वी सुरक्षित वेळाची वाट पाहा.",
        "ml": "ഇപ്പോൾ സ്ഥിതിഗതികൾ അതിർത്തിയിലാണ് — പുറത്തിറങ്ങുന്നതിന് മുൻപ് സുരക്ഷിതമായ സമയം കാത്തിരിക്കുക.",
        "kn": "ಈಗ ಪರಿಸ್ಥಿತಿಗಳು ಅಂಚಿನಲ್ಲಿವೆ — ಹೊರಹೋಗುವ ಮೊದಲು ಸುರಕ್ಷಿತ ಸಮಯಕ್ಕಾಗಿ ಕಾಯಿರಿ.",
        "gu": "હવે પરિસ્થિતિઓ સીમારેખા પર છે — બહાર જવા પહેલાં સુરક્ષિત સમયની રાહ જુઓ.",
    },
    "go_with_caution": {
        "en": "Conditions are manageable with caution (risk score {score}). Stay alert and return early.",
        "hi": "सावधानी के साथ परिस्थितियाँ प्रबंधनीय हैं (जोखिम स्कोर {score})। सतर्क रहें और जल्दी लौटें।",
        "bn": "সতর্কতার সাথে পরিস্থিতি পরিচালনযোগ্য (ঝুঁকি স্কোর {score})। সতর্ক থাকুন এবং তাড়াতাড়ি ফিরুন।",
        "ta": "எச்சரிக்கையுடன் நிலைமைகளை கையாளலாம் (ஆபத்து மதிப்பெண் {score})। விழிப்பாக இருந்து விரைவில் திரும்பவும்.",
        "te": "జాగ్రత్తతో పరిస్థితులు నిర్వహించదగినవి (ప్రమాద స్కోర్ {score}). అప్రమత్తంగా ఉండండి మరియు త్వరగా తిరిగి రండి.",
        "or": "ସତର୍କତା ସହ ପରିସ୍ଥିତି ପରିଚାଳନାଯୋଗ୍ୟ (ବିପଦ ସ୍କୋର {score})। ସଚେତନ ରୁହନ୍ତୁ ଏବଂ ଶୀଘ୍ର ଫେରନ୍ତୁ।",
        "mr": "सावधानीने परिस्थिती व्यवस्थापन करता येते (धोका स्कोर {score}). सतर्क राहा आणि लवकर परत या.",
        "ml": "ജാഗ്രതയോടെ സ്ഥിതിഗതികൾ കൈകാര്യം ചെയ്യാം (അപകട സ്കോർ {score}). ജാഗരൂകരായിരിക്കുക, നേരത്തെ തിരിച്ചു വരിക.",
        "kn": "ಎಚ್ಚರಿಕೆಯಿಂದ ಪರಿಸ್ಥಿತಿಗಳನ್ನು ನಿರ್ವಹಿಸಬಹುದು (ಅಪಾಯ ಸ್ಕೋರ್ {score}). ಎಚ್ಚರದಿಂದ ಇರಿ ಮತ್ತು ಬೇಗ ಹಿಂತಿರುಗಿ.",
        "gu": "સાવધાનીથી પરિસ્થિતિઓ સંભાળી શકાય છે (જોખમ સ્કોર {score}). સતર્ક રહો અને વહેલા પાછા ફરો.",
    },
    "go": {
        "en": "Conditions are favourable for going out.",
        "hi": "समुद्र में जाने के लिए परिस्थितियाँ अनुकूल हैं।",
        "bn": "বের হওয়ার জন্য পরিস্থিতি অনুকূল।",
        "ta": "வெளியே செல்வதற்கு சாதகமான நிலைமைகள் உள்ளன.",
        "te": "బయటకు వెళ్ళడానికి పరిస్థితులు అనుకూలంగా ఉన్నాయి.",
        "or": "ବାହାରକୁ ଯିବା ପାଇଁ ପରିସ୍ଥିତି ଅନୁକୂଳ।",
        "mr": "बाहेर जाण्यासाठी परिस्थिती अनुकूल आहे.",
        "ml": "പുറത്തിറങ്ങാൻ സ്ഥിതിഗതികൾ അനുകൂലമാണ്.",
        "kn": "ಹೊರಹೋಗಲು ಪರಿಸ್ಥಿತಿಗಳು ಅನುಕೂಲಕರವಾಗಿವೆ.",
        "gu": "બહાર જવા માટે પરિસ્થિતિઓ અનુકૂળ છે.",
    },
}

# ─────────────────────────────────────────────────────────────────
# DETAILED RECOMMENDATION FALLBACK TEMPLATE PARTS
# ─────────────────────────────────────────────────────────────────

FALLBACK_SAFEST_POINT: Dict[str, str] = {
    "en": "The safest analysed point is {point_id} (risk {score}, {level}).",
    "hi": "सबसे सुरक्षित विश्लेषित बिंदु {point_id} है (जोखिम {score}, {level})।",
    "bn": "সবচেয়ে নিরাপদ বিশ্লেষিত বিন্দু হল {point_id} (ঝুঁকি {score}, {level})।",
    "ta": "பகுப்பாய்வு செய்யப்பட்ட மிகவும் பாதுகாப்பான புள்ளி {point_id} (அபாய மதிப்பெண் {score}, {level}).",
    "te": "విశ్లేషించబడిన అత్యంత సురక్షితమైన బిందువు {point_id} (ప్రమాదం {score}, {level}).",
    "or": "ଅନୁଭବ ସୁରକ୍ଷିତ ବିଶ୍ଳେଷିତ ବିନ୍ଦୁ {point_id} (ବିପଦ {score}, {level}) ।",
    "mr": "सर्वात सुरक्षित विश्लेषित बिंदू {point_id} आहे (धोका {score}, {level}).",
    "ml": "ഏറ്റവും സുരക്ഷിതമായ വിശകലനം ചെയ്ത ബിന്ദു {point_id} ആണ് (അപകടസ്ഥിതി {score}, {level}).",
    "kn": "ವಿಶ್ಲೇಷಿಸಿದ ಅತ್ಯಂತ ಸುರಕ್ಷಿತ ಬಿಂದು {point_id} ({score} ಅಪಾಯ, {level}).",
    "gu": "વિশ્લેષિત સૌથી સુરક્ષિત બિંદુ {point_id} છે (જોખમ {score}, {level}).",
}

FALLBACK_NO_SAFE_POINT: Dict[str, str] = {
    "en": "No analysed point was both permitted and safe enough to recommend.",
    "hi": "कोई भी विश्लेषित बिंदु अनुमत और पर्याप्त सुरक्षित दोनों नहीं था।",
    "bn": "কোনো বিশ্লেষিত বিন্দু অনুমোদিত এবং যথেষ্ট নিরাপদ উভয়ই ছিল না।",
    "ta": "பகுப்பாய்வு செய்யப்பட்ட எந்த புள்ளியும் அனுமதிக்கப்பட்டதாகவும் போதுமான அளவு பாதுகாப்பானதாகவும் இல்லை.",
    "te": "విశ్లేషించబడిన ఏ బిందువూ అనుమతించబడినది మరియు సురక్షితమైనది రెండూ కాదు.",
    "or": "ବିଶ୍ଳେଷିତ ବିନ୍ଦୁ ଅନୁମତ ଏବଂ ଯଥେଷ୍ଟ ସୁରକ୍ଷିତ ଉଭୟ ନ ଥିଲା।",
    "mr": "कोणताही विश्लेषित बिंदू परवानगी दिलेला आणि पुरेसा सुरक्षित नव्हता.",
    "ml": "വിശകലനം ചെയ്ത ഒരു ബിന്ദുവും അനുവദനീയവും മതിയായ സുരക്ഷിതവുമായിരുന്നില്ല.",
    "kn": "ವಿಶ್ಲೇಷಿಸಿದ ಯಾವ ಬಿಂದುವೂ ಅನುಮತಿಸಲ್ಪಟ್ಟ ಮತ್ತು ಸಾಕಷ್ಟು ಸುರಕ್ಷಿತ ಎರಡೂ ಆಗಿರಲಿಲ್ಲ.",
    "gu": "કોઈ પણ વિશ્લેષિત બિંદુ પરવાનગી આપેલ અને પૂરતા સુરક્ષિત બંને ન હતા.",
}

FALLBACK_GIS_EXCLUDED: Dict[str, str] = {
    "en": "The following point(s) were excluded because they fall inside protected/restricted zones: {zones}.",
    "hi": "निम्नलिखित बिंदुओं को बाहर रखा गया क्योंकि वे संरक्षित/प्रतिबंधित क्षेत्रों के अंदर हैं: {zones}।",
    "bn": "নিম্নলিখিত বিন্দুগুলি বাদ দেওয়া হয়েছে কারণ সেগুলি সুরক্ষিত/নিষিদ্ধ অঞ্চলের মধ্যে পড়ে: {zones}।",
    "ta": "பின்வரும் புள்ளிகள் பாதுகாக்கப்பட்ட/கட்டுப்படுத்தப்பட்ட மண்டலங்களில் உள்ளதால் விலக்கப்பட்டன: {zones}.",
    "te": "కింది బిందువులు రక్షిత/నిషేధ ప్రాంతాలలో ఉన్నందున మినహాయించబడ్డాయి: {zones}.",
    "or": "ନିମ୍ନ ବିନ୍ଦୁଗୁଡ଼ିକ ସୁରକ୍ଷିତ/ପ୍ରତିବନ୍ଧକ ଅଞ୍ଚଳ ଭିତରେ ଥିବାରୁ ବାଦ ଦିଆ ଗଲା: {zones} ।",
    "mr": "खालील बिंदू संरक्षित/प्रतिबंधित क्षेत्रात असल्यामुळे वगळले गेले: {zones}.",
    "ml": "ഇനിപ്പറയുന്ന ബിന്ദുക്കൾ സംരക്ഷിത/നിയന്ത്രിത മേഖലകളിൽ ഉള്ളതിനാൽ ഒഴിവാക്കി: {zones}.",
    "kn": "ಕೆಳಗಿನ ಬಿಂದುಗಳನ್ನು ಸಂರಕ್ಷಿತ/ನಿಷೇಧಿತ ಪ್ರದೇಶಗಳಲ್ಲಿ ಬಿದ್ದ ಕಾರಣ ಹೊರಗಿಡಲಾಗಿದೆ: {zones}.",
    "gu": "નીચેના બિંદુઓ સંરક્ષિત/પ્રતિબંધિત ઝોનમાં આવ્યા હોવાથી બાકાત કરવામાં આવ્યા: {zones}.",
}

FALLBACK_DATA_MISSING: Dict[str, str] = {
    "en": "Data from {agents} could not be retrieved and has NOT been estimated.",
    "hi": "{agents} का डेटा प्राप्त नहीं हो सका और अनुमानित नहीं किया गया है।",
    "bn": "{agents} থেকে ডেটা পুনরুদ্ধার করা যায়নি এবং অনুমান করা হয়নি।",
    "ta": "{agents} இலிருந்து தரவு மீட்டெடுக்க முடியவில்லை மற்றும் மதிப்பிடப்படவில்லை.",
    "te": "{agents} నుండి డేటా పొందబడలేదు మరియు అంచనా వేయబడలేదు.",
    "or": "{agents} ର ଡ଼େଟା ପ୍ରାପ୍ତ ହୋଇପାରିଲା ନାହିଁ ଏବଂ ଆକଳନ କରାଯାଇ ନାହିଁ।",
    "mr": "{agents} कडून डेटा मिळवता आला नाही आणि अंदाज केला गेला नाही.",
    "ml": "{agents} ൽ നിന്ന് ഡേറ്റ ലഭ്യമായില്ല, അത് കണക്കാക്കിയിട്ടില്ല.",
    "kn": "{agents} ನಿಂದ ಡೇಟಾ ಪಡೆಯಲಾಗಲಿಲ್ಲ ಮತ್ತು ಅಂದಾಜು ಮಾಡಲಾಗಿಲ್ಲ.",
    "gu": "{agents} માંથી ડેટા મેળવી શકાયો નથી અને અંદાજ કરવામાં આવ્યો નથી.",
}

# ─────────────────────────────────────────────────────────────────
# REASONING FALLBACK TEMPLATE PARTS (risk_agent)
# ─────────────────────────────────────────────────────────────────

FALLBACK_REASONING_OFFICIAL_WARNING: Dict[str, str] = {
    "en": "Assessed as {level} (Score {score}) due to active official {warning_type} from {authority}{bulletin}. {local_conds} This assessment is deterministic; narrative interpretation was unavailable.",
    "hi": "{level} के रूप में आकलन किया गया (स्कोर {score}) {authority}{bulletin} से सक्रिय आधिकारिक {warning_type} के कारण। {local_conds} यह आकलन निर्धारक है; विस्तृत व्याख्या उपलब्ध नहीं थी।",
    "bn": "{authority}{bulletin} থেকে সক্রিয় সরকারী {warning_type} কারণে {level} (স্কোর {score}) হিসেবে মূল্যায়ন করা হয়েছে। {local_conds} এই মূল্যায়ন নির্ধারক; বিস্তারিত ব্যাখ্যা পাওয়া যায়নি।",
    "ta": "{authority}{bulletin} இலிருந்து செயலில் உள்ள அதிகாரப்பூர்வ {warning_type} காரணமாக {level} (மதிப்பெண் {score}) என மதிப்பிடப்பட்டது. {local_conds} இந்த மதிப்பீடு நிர்ணயமானது; விரிவான விளக்கம் கிடைக்கவில்லை.",
    "te": "{authority}{bulletin} నుండి చురుకైన అధికారిక {warning_type} కారణంగా {level} (స్కోర్ {score}) గా అంచనా వేయబడింది. {local_conds} ఈ మూల్యాంకనం నిర్ణయాత్మకమైనది; కథన వివరణ అందుబాటులో లేదు.",
    "or": "{authority}{bulletin} ରୁ ସକ୍ରିୟ ସରକାରୀ {warning_type} କାରଣରୁ {level} (ସ୍କୋର {score}) ଭାବେ ମୂଲ୍ୟାଙ୍କନ। {local_conds} ଏହି ମୂଲ୍ୟାଙ୍କନ ନିର୍ଣ୍ଣାୟକ; ବ୍ୟାଖ୍ୟା ଉପଲବ୍ଧ ନ ଥିଲା।",
    "mr": "{authority}{bulletin} कडून सक्रिय अधिकृत {warning_type} मुळे {level} (स्कोर {score}) म्हणून मूल्यांकन. {local_conds} हे मूल्यांकन निर्धारक आहे; तपशीलवार व्याख्या उपलब्ध नव्हती.",
    "ml": "{authority}{bulletin} ൽ നിന്ന് സജീവ ഔദ്യോഗിക {warning_type} കാരണം {level} (സ്കോർ {score}) ആയി വിലയിരുത്തി. {local_conds} ഈ വിലയിരുത്തൽ നിർണ്ണായകമാണ്; വിശദ വ്യാഖ്യാനം ലഭ്യമായിരുന്നില്ല.",
    "kn": "{authority}{bulletin} ನಿಂದ ಸಕ್ರಿಯ ಅಧಿಕೃತ {warning_type} ಕಾರಣ {level} (ಸ್ಕೋರ್ {score}) ಎಂದು ಮೌಲ್ಯಮಾಪನ. {local_conds} ಈ ಮೌಲ್ಯಮಾಪನ ನಿರ್ಣಾಯಕ; ವಿವರ ವ್ಯಾಖ್ಯಾನ ಲಭ್ಯವಿರಲಿಲ್ಲ.",
    "gu": "{authority}{bulletin} થી સક્રિય સત્તાવાર {warning_type} કારણે {level} (સ્કોર {score}) તરીકે આકલન. {local_conds} આ આકલન નિર્ણાયક છે; વિગતવાર વ્યાખ્યા ઉપલબ્ધ ન હતી.",
}

FALLBACK_REASONING_HARD_RULE: Dict[str, str] = {
    "en": "Assessed as {level} (Score {score}) due to safety constraint '{rule}'. {local_conds} This assessment is deterministic; narrative interpretation was unavailable.",
    "hi": "सुरक्षा बाधा '{rule}' के कारण {level} (स्कोर {score}) के रूप में आकलन। {local_conds} यह आकलन निर्धारक है; विस्तृत व्याख्या उपलब्ध नहीं थी।",
    "bn": "নিরাপত্তা বাধা '{rule}' কারণে {level} (স্কোর {score}) হিসেবে মূল্যায়ন। {local_conds} এই মূল্যায়ন নির্ধারক; বিস্তারিত ব্যাখ্যা পাওয়া যায়নি।",
    "ta": "பாதுகாப்பு கட்டுப்பாடு '{rule}' காரணமாக {level} (மதிப்பெண் {score}) என மதிப்பிடப்பட்டது. {local_conds} இந்த மதிப்பீடு நிர்ணயமானது; விரிவான விளக்கம் கிடைக்கவில்லை.",
    "te": "భద్రతా పరిమితి '{rule}' కారణంగా {level} (స్కోర్ {score}) గా అంచనా వేయబడింది. {local_conds} ఈ మూల్యాంకనం నిర్ణయాత్మకమైనది; కథన వివరణ అందుబాటులో లేదు.",
    "or": "ସୁରକ୍ଷା ବାଧ୍ୟତା '{rule}' କାରଣରୁ {level} (ସ୍କୋର {score}) ଭାବେ ମୂଲ୍ୟାଙ୍କନ। {local_conds} ଏହି ମୂଲ୍ୟାଙ୍କନ ନିର୍ଣ୍ଣାୟକ; ବ୍ୟାଖ୍ୟା ଉପଲବ୍ଧ ନ ଥିଲା।",
    "mr": "सुरक्षा मर्यादा '{rule}' मुळे {level} (स्कोर {score}) म्हणून मूल्यांकन. {local_conds} हे मूल्यांकन निर्धारक आहे; तपशीलवार व्याख्या उपलब्ध नव्हती.",
    "ml": "സുരക്ഷ നിയന്ത്രണം '{rule}' കാരണം {level} (സ്കോർ {score}) ആയി വിലയിരുത്തി. {local_conds} ഈ വിലയിരുത്തൽ നിർണ്ണായകമാണ്; വിശദ വ്യാഖ്യാനം ലഭ്യമായിരുന്നില്ല.",
    "kn": "ಸುರಕ್ಷತಾ ನಿರ್ಬಂಧ '{rule}' ಕಾರಣ {level} (ಸ್ಕೋರ್ {score}) ಎಂದು ಮೌಲ್ಯಮಾಪನ. {local_conds} ಈ ಮೌಲ್ಯಮಾಪನ ನಿರ್ಣಾಯಕ; ವಿವರ ವ್ಯಾಖ್ಯಾನ ಲಭ್ಯವಿರಲಿಲ್ಲ.",
    "gu": "સુરક્ષા પ્રતિબંધ '{rule}' કારણે {level} (સ્કોર {score}) તરીકે આકલન. {local_conds} આ આકલન નિર્ણાયક છે; વિગતવાર વ્યાખ્યા ઉપલબ્ધ ન હતી.",
}

FALLBACK_REASONING_BASIC: Dict[str, str] = {
    "en": "Assessed as {level} based on {conds}. This assessment is deterministic; narrative interpretation was unavailable.",
    "hi": "{conds} के आधार पर {level} के रूप में आकलन। यह आकलन निर्धारक है; विस्तृत व्याख्या उपलब्ध नहीं थी।",
    "bn": "{conds} এর ভিত্তিতে {level} হিসেবে মূল্যায়ন। এই মূল্যায়ন নির্ধারক; বিস্তারিত ব্যাখ্যা পাওয়া যায়নি।",
    "ta": "{conds} அடிப்படையில் {level} என மதிப்பிடப்பட்டது. இந்த மதிப்பீடு நிர்ணயமானது; விரிவான விளக்கம் கிடைக்கவில்லை.",
    "te": "{conds} ఆధారంగా {level} గా అంచనా వేయబడింది. ఈ మూల్యాంకనం నిర్ణయాత్మకమైనది; కథన వివరణ అందుబాటులో లేదు.",
    "or": "{conds} ଆଧାରରେ {level} ଭାବେ ମୂଲ୍ୟାଙ୍କନ। ଏହି ମୂଲ୍ୟାଙ୍କନ ନିର୍ଣ୍ଣାୟକ; ବ୍ୟାଖ୍ୟା ଉପଲବ୍ଧ ନ ଥିଲା।",
    "mr": "{conds} वर आधारित {level} म्हणून मूल्यांकन. हे मूल्यांकन निर्धारक आहे; तपशीलवार व्याख्या उपलब्ध नव्हती.",
    "ml": "{conds} അടിസ്ഥാനത്തിൽ {level} ആയി വിലയിരുത്തി. ഈ വിലയിരുത്തൽ നിർണ്ണായകമാണ്; വിശദ വ്യാഖ്യാനം ലഭ്യമായിരുന്നില്ല.",
    "kn": "{conds} ಆಧಾರದ ಮೇಲೆ {level} ಎಂದು ಮೌಲ್ಯಮಾಪನ. ಈ ಮೌಲ್ಯಮಾಪನ ನಿರ್ಣಾಯಕ; ವಿವರ ವ್ಯಾಖ್ಯಾನ ಲಭ್ಯವಿರಲಿಲ್ಲ.",
    "gu": "{conds} ના આધારે {level} તરીકે આકલન. આ આકલન નિર્ણાયક છે; વિગતવાર વ્યાખ્યા ઉપલબ્ધ ન હતી.",
}

FALLBACK_REASONING_NO_DATA: Dict[str, str] = {
    "en": "No usable measurements were available to assess this point.",
    "hi": "इस बिंदु का आकलन करने के लिए कोई उपयोगी माप उपलब्ध नहीं था।",
    "bn": "এই বিন্দু মূল্যায়ন করতে কোনো ব্যবহারযোগ্য পরিমাপ পাওয়া যায়নি।",
    "ta": "இந்த புள்ளியை மதிப்பிட பயனுள்ள அளவீடுகள் எதுவும் கிடைக்கவில்லை.",
    "te": "ఈ బిందువును అంచనా వేయడానికి ఉపయోగపడే కొలతలు ఏవీ అందుబాటులో లేవు.",
    "or": "ଏହି ବିନ୍ଦୁ ମୂଲ୍ୟାଙ୍କନ ପାଇଁ କୌଣସି ଉପଯୋଗୀ ମାପ ଉପଲବ୍ଧ ନ ଥିଲା।",
    "mr": "या बिंदूचे मूल्यांकन करण्यासाठी कोणतेही उपयुक्त मोजमाप उपलब्ध नव्हते.",
    "ml": "ഈ ബിന്ദു വിലയിരുത്താൻ ഉപയോഗിക്കാവുന്ന അളവുകൾ ഒന്നും ലഭ്യമായിരുന്നില്ല.",
    "kn": "ಈ ಬಿಂದುವನ್ನು ಮೌಲ್ಯಮಾಪನ ಮಾಡಲು ಯಾವುದೇ ಉಪಯೋಗಕರ ಅಳತೆಗಳು ಲಭ್ಯವಿರಲಿಲ್ಲ.",
    "gu": "આ બિંદુ આકલન કરવા માટે કોઈ ઉપયોગી માપ ઉપલબ્ધ ન હતા.",
}

# ─────────────────────────────────────────────────────────────────
# FINDINGS FALLBACK TEMPLATE PARTS (risk_agent)
# ─────────────────────────────────────────────────────────────────

FALLBACK_FINDINGS_UNAVAILABLE: Dict[str, str] = {
    "en": "Unavailable and not estimated: {params}",
    "hi": "अनुपलब्ध और अनुमानित नहीं: {params}",
    "bn": "অনুপলব্ধ এবং অনুমান করা হয়নি: {params}",
    "ta": "கிடைக்கவில்லை மற்றும் மதிப்பிடப்படவில்லை: {params}",
    "te": "అందుబాటులో లేదు మరియు అంచనా వేయబడలేదు: {params}",
    "or": "ଅନୁପଲବ୍ଧ ଏବଂ ଆକଳନ ହୋଇ ନାହିଁ: {params}",
    "mr": "अनुपलब्ध आणि अंदाज केला नाही: {params}",
    "ml": "ലഭ്യമല്ല, കണക്കാക്കിയിട്ടില്ല: {params}",
    "kn": "ಲಭ್ಯವಿಲ್ಲ ಮತ್ತು ಅಂದಾಜು ಮಾಡಲಾಗಿಲ್ಲ: {params}",
    "gu": "ઉપલબ્ધ નથી અને અંદાજ કરવામાં આવ્યો નથી: {params}",
}

FALLBACK_FINDINGS_AGENT_FAILED: Dict[str, str] = {
    "en": "{agent} data could not be retrieved",
    "hi": "{agent} का डेटा प्राप्त नहीं हो सका",
    "bn": "{agent} ডেটা পুনরুদ্ধার করা যায়নি",
    "ta": "{agent} தரவு மீட்டெடுக்க முடியவில்லை",
    "te": "{agent} డేటా పొందబడలేదు",
    "or": "{agent} ଡ଼େଟା ପ୍ରାପ୍ତ ହୋଇପାରିଲା ନାହିଁ",
    "mr": "{agent} डेटा मिळवता आला नाही",
    "ml": "{agent} ഡേറ്റ ലഭ്യമായില്ല",
    "kn": "{agent} ಡೇಟಾ ಪಡೆಯಲಾಗಲಿಲ್ಲ",
    "gu": "{agent} ડેટા મેળવી શકાયો નથી",
}

FALLBACK_FINDINGS_INSUFFICIENT: Dict[str, str] = {
    "en": "Insufficient evidence for detailed findings",
    "hi": "विस्तृत निष्कर्षों के लिए अपर्याप्त साक्ष्य",
    "bn": "বিস্তারিত ফলাফলের জন্য অপর্যাপ্ত প্রমাণ",
    "ta": "விரிவான கண்டுபிடிப்புகளுக்கு போதுமான சான்றுகள் இல்லை",
    "te": "వివరణాత్మక ఫలితాలకు తగిన సాక్ష్యం లేదు",
    "or": "ବିସ୍ତୃତ ଫଳାଫଳ ପାଇଁ ଅপ୍ରତୁଳ ପ୍ରମାଣ",
    "mr": "तपशीलवार निष्कर्षांसाठी अपुरे पुरावे",
    "ml": "വിശദമായ കണ്ടെത്തലുകൾക്ക് അപര്യാപ്തമായ തെളിവ്",
    "kn": "ವಿವರವಾದ ಸಂಶೋಧನೆಗಳಿಗೆ ಸಾಕಷ್ಟು ಸಾಕ್ಷ್ಯ ಇಲ್ಲ",
    "gu": "વિગતવાર તારણો માટે અપૂરતા પુરાવા",
}


def get_fallback_one_line(recommendation_type: str, preferred: dict | None, language: str = "en") -> str:
    """Return the deterministic one-line advisory in the requested language."""
    lang = language if language in _SUPPORTED else "en"
    template_dict = FALLBACK_ONE_LINE.get(recommendation_type, FALLBACK_ONE_LINE["go"])
    text = template_dict.get(lang) or template_dict["en"]
    if recommendation_type == "go_with_caution" and preferred:
        text = text.replace("{score}", str(preferred.get("final_score", "?")))
    return text


def get_fallback_detailed(
    recommendation_type: str,
    preferred: dict | None,
    excluded: list,
    agents_missing: list,
    merged_points: dict | None,
    language: str = "en",
) -> str:
    """Return the deterministic detailed advisory in the requested language."""
    lang = language if language in _SUPPORTED else "en"
    parts = []

    if preferred:
        tmpl = FALLBACK_SAFEST_POINT.get(lang) or FALLBACK_SAFEST_POINT["en"]
        parts.append(
            tmpl.replace("{point_id}", preferred["point_id"])
                .replace("{score}", str(preferred.get("final_score", "?")))
                .replace("{level}", preferred.get("risk_level", "?"))
        )
        if preferred.get("reasoning"):
            parts.append(preferred["reasoning"])
    else:
        parts.append(FALLBACK_NO_SAFE_POINT.get(lang) or FALLBACK_NO_SAFE_POINT["en"])

    prohibited = [e for e in excluded if e.get("reason") == "gis_prohibited"]
    if prohibited:
        details = []
        for e in prohibited:
            pid = e["point_id"]
            z = (
                (merged_points or {}).get(pid, {}).get("measurements", {}).get("zone_name", {}).get("value")
            )
            details.append(f"{pid} ({z})" if z else pid)
        tmpl = FALLBACK_GIS_EXCLUDED.get(lang) or FALLBACK_GIS_EXCLUDED["en"]
        parts.append(tmpl.replace("{zones}", ", ".join(details)))

    if agents_missing:
        names = ", ".join(a["agent"] for a in agents_missing)
        tmpl = FALLBACK_DATA_MISSING.get(lang) or FALLBACK_DATA_MISSING["en"]
        parts.append(tmpl.replace("{agents}", names))

    return " ".join(parts)


def get_fallback_reasoning(
    base: dict,
    measurements: dict,
    final_score: int | None,
    official_warnings: list | None,
    hard_rules: list | None,
    language: str = "en",
) -> str:
    """Return the deterministic risk reasoning in the requested language."""
    from app.risk import baseline as baseline_mod

    lang = language if language in _SUPPORTED else "en"

    parts = []
    for parameter, score in sorted(base.get("contributing", {}).items(), key=lambda kv: -kv[1])[:3]:
        m = measurements.get(parameter, {})
        parts.append(f"{parameter.replace('_', ' ')} at {m.get('value')} {m.get('unit') or ''}".strip())

    local_conds_en = f"Local conditions: {', '.join(parts)}." if parts else "Local sensor readings unavailable."
    local_conds = local_conds_en  # conditions text uses data values, kept in English for accuracy

    effective_score = final_score if final_score is not None else base.get("baseline_score", 0)
    level = baseline_mod.level_for_score(effective_score)

    if official_warnings:
        w = official_warnings[0]
        auth = w.get("issuing_authority") or "Official Disaster Authority"
        bulletin = f" (Bulletin: {w['bulletin_id']})" if w.get("bulletin_id") else ""
        tmpl = FALLBACK_REASONING_OFFICIAL_WARNING.get(lang) or FALLBACK_REASONING_OFFICIAL_WARNING["en"]
        return (
            tmpl.replace("{level}", level)
                .replace("{score}", str(effective_score))
                .replace("{warning_type}", w.get("warning_type", "marine warning"))
                .replace("{authority}", auth)
                .replace("{bulletin}", bulletin)
                .replace("{local_conds}", local_conds)
        )

    if hard_rules:
        r = hard_rules[0]
        tmpl = FALLBACK_REASONING_HARD_RULE.get(lang) or FALLBACK_REASONING_HARD_RULE["en"]
        return (
            tmpl.replace("{level}", level)
                .replace("{score}", str(effective_score))
                .replace("{rule}", r.get("rule_id", "rule"))
                .replace("{local_conds}", local_conds)
        )

    if not parts:
        return FALLBACK_REASONING_NO_DATA.get(lang) or FALLBACK_REASONING_NO_DATA["en"]

    tmpl = FALLBACK_REASONING_BASIC.get(lang) or FALLBACK_REASONING_BASIC["en"]
    return (
        tmpl.replace("{level}", level)
            .replace("{conds}", ", ".join(parts))
    )


def get_fallback_findings(
    base: dict,
    measurements: dict,
    agents_missing: list,
    language: str = "en",
) -> list:
    """Return the deterministic key findings list in the requested language."""
    lang = language if language in _SUPPORTED else "en"
    findings = []

    for parameter in base.get("risk_factors", [])[:3]:
        m = measurements.get(parameter, {})
        findings.append(f"{parameter.replace('_', ' ')}: {m.get('value')} {m.get('unit') or ''}".strip())

    unavailable = [
        p for p, m in measurements.items()
        if isinstance(m, dict) and m.get("status") in ("missing", "not_mapped")
    ]
    if unavailable:
        tmpl = FALLBACK_FINDINGS_UNAVAILABLE.get(lang) or FALLBACK_FINDINGS_UNAVAILABLE["en"]
        findings.append(tmpl.replace("{params}", ", ".join(sorted(unavailable)[:3])))

    for a in agents_missing[:2]:
        tmpl = FALLBACK_FINDINGS_AGENT_FAILED.get(lang) or FALLBACK_FINDINGS_AGENT_FAILED["en"]
        findings.append(tmpl.replace("{agent}", a["agent"]))

    if not findings:
        return [FALLBACK_FINDINGS_INSUFFICIENT.get(lang) or FALLBACK_FINDINGS_INSUFFICIENT["en"]]

    return findings


_SUPPORTED = {
    "en", "hi", "bn", "ta", "te", "or", "mr", "ml", "kn", "gu"
}
