// Hindi coverage for text that has no data-i18n attribute.
// Works on exact English strings (static markup, toasts, server messages and
// dynamically rendered UI) and keeps the original so switching back is lossless.
// Depends on app.js: currentLang, applyTranslations().

var HI_TEXT = {
  // Login
  'Find skilled help': 'कुशल मदद पाएं',
  'right near you': 'बिल्कुल आपके पास',
  'Plumbers · Electricians · Maids · AC Repair · and more': 'प्लंबर · इलेक्ट्रीशियन · मेड · AC रिपेयर · और भी बहुत कुछ',
  'Enter your number': 'अपना नंबर दर्ज करें',
  "We'll send a 4-digit OTP to verify": 'हम सत्यापन के लिए 4 अंकों का OTP भेजेंगे',
  'Send OTP →': 'OTP भेजें →',
  'New here? Your account is created automatically.': 'नए हैं? आपका अकाउंट अपने आप बन जाएगा।',
  '← Back': '← वापस',
  'Enter OTP': 'OTP दर्ज करें',
  'Sent to': 'भेजा गया',
  'Verify & Continue →': 'सत्यापित करें और आगे बढ़ें →',
  "Didn't receive?": 'नहीं मिला?',
  'Resend OTP': 'OTP दोबारा भेजें',
  'Nearby': 'पास में',
  'Verified': 'सत्यापित',
  'Rated': 'रेटेड',
  'Workers': 'वर्कर',
  'Happy customers': 'खुश ग्राहक',
  'Avg rating': 'औसत रेटिंग',
  'Avg Rating': 'औसत रेटिंग',

  // Nav / menu
  'My Profile': 'मेरी प्रोफ़ाइल',
  'Worker Dashboard': 'वर्कर डैशबोर्ड',
  'Become a Worker': 'वर्कर बनें',
  'Logout': 'लॉग आउट',
  'Home': 'होम',
  'Search': 'खोजें',
  'Profile': 'प्रोफ़ाइल',
  'Work': 'काम',
  'Set location': 'लोकेशन सेट करें',

  // Home
  'Find skilled workers near you': 'अपने पास कुशल वर्कर खोजें',
  'Verified, trusted, available — just a tap away': 'सत्यापित, भरोसेमंद, उपलब्ध — बस एक टैप दूर',
  'Categories': 'श्रेणियाँ',
  'All': 'सभी',
  '2 km': '2 किमी', '5 km': '5 किमी', '10 km': '10 किमी', '20 km': '20 किमी',
  'Best match': 'सबसे उपयुक्त',
  'Offers for you': 'आपके लिए ऑफ़र',
  'Search by name or skill...': 'नाम या हुनर से खोजें...',
  'Search workers, services…': 'वर्कर, सेवाएँ खोजें…',

  // Worker page
  '← Back to Search': '← खोज पर वापस',
  'Experience': 'अनुभव',
  'Price Range': 'कीमत सीमा',
  'Reviews': 'रिव्यू',
  'Call Now': 'अभी कॉल करें',
  'Report': 'रिपोर्ट करें',
  'About': 'परिचय',
  'Contact this worker (call or WhatsApp) to unlock reviews.': 'रिव्यू देने के लिए इस वर्कर से संपर्क करें (कॉल या WhatsApp)।',
  'Write a Review': 'रिव्यू लिखें',
  'Submit Review': 'रिव्यू सबमिट करें',
  'Loading…': 'लोड हो रहा है…',
  'Loading reviews…': 'रिव्यू लोड हो रहे हैं…',
  'Loading categories…': 'श्रेणियाँ लोड हो रही हैं…',
  'Share your experience with this worker…': 'इस वर्कर के साथ अपना अनुभव साझा करें…',
  'Services & Prices': 'सेवाएँ और कीमतें',
  'Recent Work': 'हाल का काम',
  'No reviews yet. Be the first to review!': 'अभी कोई रिव्यू नहीं। पहला रिव्यू आप दें!',
  'You have already reviewed this worker.': 'आप इस वर्कर को पहले ही रिव्यू दे चुके हैं।',
  'Load more': 'और दिखाएँ',

  // Register / worker dashboard
  'Register as a Worker': 'वर्कर के रूप में रजिस्टर करें',
  'Create your profile and start getting clients today': 'अपनी प्रोफ़ाइल बनाएँ और आज ही ग्राहक पाना शुरू करें',
  'Bio / Description': 'परिचय / विवरण',
  'Experience (years)': 'अनुभव (वर्ष)',
  'Categories (select all that apply)': 'श्रेणियाँ (सभी लागू चुनें)',
  'Location': 'लोकेशन',
  'Use My Current Location': 'मेरी वर्तमान लोकेशन उपयोग करें',
  'Create Worker Profile': 'वर्कर प्रोफ़ाइल बनाएँ',
  'Edit Profile': 'प्रोफ़ाइल संपादित करें',
  'Full Name': 'पूरा नाम',
  'Save Changes': 'बदलाव सहेजें',
  'Pending Verification': 'सत्यापन लंबित',
  'Share Profile': 'प्रोफ़ाइल शेयर करें',
  'QR Code': 'QR कोड',
  'Reach & Visibility': 'पहुँच और दृश्यता',
  'Users who tried to contact you': 'जिन लोगों ने आपसे संपर्क करने की कोशिश की',
  'Today': 'आज',
  'This Week': 'इस सप्ताह',
  '30 Days': '30 दिन',
  'Calls': 'कॉल',
  'Profile Photo': 'प्रोफ़ाइल फ़ोटो',
  'JPG, PNG or WebP · Max 5MB': 'JPG, PNG या WebP · अधिकतम 5MB',
  'Upload Photo': 'फ़ोटो अपलोड करें',
  'Services & prices': 'सेवाएँ और कीमतें',
  'Photos of your work': 'आपके काम की फ़ोटो',
  'Save Profile': 'प्रोफ़ाइल सहेजें',
  'My Status': 'मेरी स्थिति',
  'Control your visibility to customers': 'ग्राहकों को आप कैसे दिखें, यह तय करें',
  'Available': 'उपलब्ध',
  'Busy': 'व्यस्त',
  'Offline': 'ऑफ़लाइन',
  'My Location': 'मेरी लोकेशन',
  'Location not set — customers cannot find you': 'लोकेशन सेट नहीं है — ग्राहक आपको नहीं ढूँढ पाएँगे',
  'Update My Location': 'मेरी लोकेशन अपडेट करें',
  'My Reviews': 'मेरे रिव्यू',
  'Describe your skills and experience…': 'अपने हुनर और अनुभव के बारे में बताएँ…',
  'Describe your skills…': 'अपने हुनर के बारे में बताएँ…',
  'Enter your name': 'अपना नाम दर्ज करें',
  'e.g. 5': 'जैसे 5',

  // Profile strength / verification / gallery / stats
  'Profile Strength': 'प्रोफ़ाइल की मजबूती',
  'Complete these to get more customers:': 'ज़्यादा ग्राहक पाने के लिए इन्हें पूरा करें:',
  'Great job — your profile is complete!': 'बहुत बढ़िया — आपकी प्रोफ़ाइल पूरी है!',
  'Add a profile photo': 'प्रोफ़ाइल फ़ोटो जोड़ें',
  'Write a bio (at least 30 characters)': 'परिचय लिखें (कम से कम 30 अक्षर)',
  'Choose your categories': 'अपनी श्रेणियाँ चुनें',
  'Set your location': 'अपनी लोकेशन सेट करें',
  'Add a price range': 'कीमत सीमा जोड़ें',
  'List your services and prices': 'अपनी सेवाएँ और कीमतें लिखें',
  'Upload photos of your work': 'अपने काम की फ़ोटो अपलोड करें',
  'Submit your ID for verification': 'सत्यापन के लिए अपना ID जमा करें',
  'Verification': 'सत्यापन',
  'Your profile is verified. Customers see the Verified badge.': 'आपकी प्रोफ़ाइल सत्यापित है। ग्राहकों को सत्यापित बैज दिखता है।',
  'Your ID is under review. We usually respond within 24 hours.': 'आपका ID जाँच में है। हम आमतौर पर 24 घंटे में जवाब देते हैं।',
  'Upload a government ID to earn the Verified badge. Only our admin team can see it.': 'सत्यापित बैज पाने के लिए सरकारी ID अपलोड करें। इसे केवल हमारी एडमिन टीम देख सकती है।',
  'ID type': 'ID का प्रकार',
  'Aadhaar': 'आधार',
  'PAN': 'पैन',
  'Voter ID': 'वोटर ID',
  'Driving licence': 'ड्राइविंग लाइसेंस',
  'Other': 'अन्य',
  'Photo or PDF of the ID (max 5MB)': 'ID की फ़ोटो या PDF (अधिकतम 5MB)',
  'Submit for verification': 'सत्यापन के लिए जमा करें',
  'Add work photos': 'काम की फ़ोटो जोड़ें',
  'Maximum of 8 photos reached.': 'अधिकतम 8 फ़ोटो की सीमा पूरी हो गई।',
  'Scan to view my profile': 'मेरी प्रोफ़ाइल देखने के लिए स्कैन करें',
  'Print': 'प्रिंट',
  'Close': 'बंद करें',
  'Profile views': 'प्रोफ़ाइल व्यू',
  'Views → contacts': 'व्यू → संपर्क',
  'Marked hired': 'हायर किए गए',
  'Hire rate': 'हायर दर',
  'Contacts, last 7 days': 'संपर्क, पिछले 7 दिन',
  'No contact attempts yet.': 'अभी तक कोई संपर्क प्रयास नहीं।',
  'Yes, hired': 'हाँ, हायर किया',
  'No': 'नहीं',
  'You contacted them recently. Your answer helps others.': 'आपने हाल ही में संपर्क किया था। आपका जवाब दूसरों की मदद करता है।',

  // Report / location modals
  'Report Worker': 'वर्कर की रिपोर्ट करें',
  'Select a reason and describe the issue. Our team reviews every report within 24 hours.': 'कारण चुनें और समस्या बताएँ। हमारी टीम हर रिपोर्ट 24 घंटे में देखती है।',
  'Poor quality of work': 'काम की खराब गुणवत्ता',
  'Overcharged / fraudulent pricing': 'ज़्यादा पैसे माँगे / धोखाधड़ी',
  'Rude or unprofessional behaviour': 'बदतमीज़ी या अव्यावसायिक व्यवहार',
  'Did not show up': 'आए ही नहीं',
  'Safety concern': 'सुरक्षा संबंधी चिंता',
  'Additional details': 'अतिरिक्त जानकारी',
  '(optional)': '(वैकल्पिक)',
  'Cancel': 'रद्द करें',
  'Submit Report': 'रिपोर्ट सबमिट करें',
  'Describe what happened…': 'क्या हुआ, बताएँ…',
  'Change Location': 'लोकेशन बदलें',
  'No location set': 'लोकेशन सेट नहीं है',
  'Use my current location': 'मेरी वर्तमान लोकेशन उपयोग करें',
  'Automatically detect via GPS': 'GPS से अपने आप पता लगाएँ',
  'or search for a place': 'या कोई जगह खोजें',
  'City, area, or landmark…': 'शहर, इलाका या लैंडमार्क…',

  // Toasts and server messages
  'Bio is required.': 'परिचय आवश्यक है।',
  'Could not get location. Please allow location access.': 'लोकेशन नहीं मिली। कृपया लोकेशन की अनुमति दें।',
  'Could not get location.': 'लोकेशन नहीं मिली।',
  'Could not load profile.': 'प्रोफ़ाइल लोड नहीं हो सकी।',
  'Could not load worker profile.': 'वर्कर प्रोफ़ाइल लोड नहीं हो सकी।',
  'Geolocation not supported by your browser.': 'आपका ब्राउज़र लोकेशन सपोर्ट नहीं करता।',
  'Geolocation not supported.': 'लोकेशन सपोर्ट उपलब्ध नहीं है।',
  'Great! Please rate your experience.': 'बढ़िया! कृपया अपना अनुभव रेट करें।',
  'Location updated!': 'लोकेशन अपडेट हो गई!',
  'Network error. Check your connection.': 'नेटवर्क त्रुटि। अपना कनेक्शन जाँचें।',
  'Network error.': 'नेटवर्क त्रुटि।',
  'Please add a bio.': 'कृपया परिचय जोड़ें।',
  'Please capture your location first.': 'कृपया पहले अपनी लोकेशन लें।',
  'Please enter your name.': 'कृपया अपना नाम दर्ज करें।',
  'Please select a star rating.': 'कृपया स्टार रेटिंग चुनें।',
  'Profile link copied!': 'प्रोफ़ाइल लिंक कॉपी हो गया!',
  'Profile photo updated!': 'प्रोफ़ाइल फ़ोटो अपडेट हो गई!',
  'Profile saved!': 'प्रोफ़ाइल सहेज ली गई!',
  'Profile updated!': 'प्रोफ़ाइल अपडेट हो गई!',
  'Review submitted! Thank you.': 'रिव्यू सबमिट हो गया! धन्यवाद।',
  'Select at least one category.': 'कम से कम एक श्रेणी चुनें।',
  'Session expired. Please log in again.': 'सेशन समाप्त हो गया। कृपया फिर से लॉग इन करें।',
  'Worker profile created! Pending admin verification.': 'वर्कर प्रोफ़ाइल बन गई! एडमिन सत्यापन लंबित है।',
  'Enter a valid 10-digit phone number.': 'सही 10 अंकों का फ़ोन नंबर दर्ज करें।',
  'Enter the complete 4-digit OTP.': 'पूरा 4 अंकों का OTP दर्ज करें।',
  'Photos added!': 'फ़ोटो जोड़ दी गईं!',
  'Please choose a file first.': 'कृपया पहले फ़ाइल चुनें।',
  'Please contact this worker before leaving a review': 'रिव्यू देने से पहले कृपया इस वर्कर से संपर्क करें',
  'You cannot review yourself': 'आप खुद को रिव्यू नहीं दे सकते',
  'You have already reviewed this worker': 'आप इस वर्कर को पहले ही रिव्यू दे चुके हैं',
  'Thanks for your feedback': 'आपकी प्रतिक्रिया के लिए धन्यवाद',
  'Submitted for verification. We will review it shortly.': 'सत्यापन के लिए जमा हो गया। हम जल्द ही इसकी जाँच करेंगे।',
};

// Patterns with numbers / names
var HI_RULES = [
  [/^Active now$/, 'अभी सक्रिय'],
  [/^Active (\d+)m ago$/, '$1 मिनट पहले सक्रिय'],
  [/^Active (\d+)h ago$/, '$1 घंटे पहले सक्रिय'],
  [/^Active (\d+)d ago$/, '$1 दिन पहले सक्रिय'],
  [/^Did you hire (.+)\?$/, 'क्या आपने $1 को हायर किया?'],
  [/^(\d+) found$/, '$1 मिले'],
  [/^Status updated to (.+)$/, 'स्थिति अपडेट हुई: $1'],
  [/^Last submission was rejected: (.+)$/, 'पिछला सबमिशन अस्वीकार हुआ: $1'],
];

function hiTranslate(text) {
  if (HI_TEXT[text] !== undefined) return HI_TEXT[text];
  for (var i = 0; i < HI_RULES.length; i++) {
    if (HI_RULES[i][0].test(text)) return text.replace(HI_RULES[i][0], HI_RULES[i][1]);
  }
  return null;
}

var _i18nBusy = false;

function applyStaticHi() {
  if (_i18nBusy || !document.body) return;
  _i18nBusy = true;
  try {
    var toHindi = (typeof currentLang !== 'undefined') && currentLang === 'hi';
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode && n.parentNode.nodeName;
        return p === 'SCRIPT' || p === 'STYLE' || p === 'TEXTAREA' ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    });
    var node;
    while ((node = walker.nextNode())) {
      var raw = node.nodeValue;
      var trimmed = raw.replace(/\s+/g, ' ').trim();
      if (!trimmed) continue;
      if (toHindi) {
        if (node.__en !== undefined && node.__hi === raw) continue; // already translated
        var hi = hiTranslate(trimmed);
        if (hi != null) {
          node.__en = raw;
          var lead = raw.match(/^\s*/)[0], tail = raw.match(/\s*$/)[0];
          node.__hi = lead + hi + tail;
          node.nodeValue = node.__hi;
        }
      } else if (node.__en !== undefined && node.__hi === raw) {
        node.nodeValue = node.__en;
        delete node.__en; delete node.__hi;
      }
    }
    document.querySelectorAll('[placeholder]').forEach(function (el) {
      var ph = el.getAttribute('placeholder');
      if (toHindi) {
        var hi = hiTranslate(ph);
        if (hi != null) { if (el.dataset.enPh === undefined) el.dataset.enPh = ph; el.setAttribute('placeholder', hi); }
      } else if (el.dataset.enPh !== undefined) {
        el.setAttribute('placeholder', el.dataset.enPh);
        delete el.dataset.enPh;
      }
    });
  } finally {
    _i18nBusy = false;
  }
}

// Re-run after the base translator, and whenever the UI re-renders
var _baseApplyTranslations = applyTranslations;
applyTranslations = function () {
  _baseApplyTranslations();
  applyStaticHi();
};

var _i18nQueued = false;
new MutationObserver(function () {
  if (_i18nBusy || _i18nQueued) return;
  if (typeof currentLang === 'undefined' || currentLang !== 'hi') return;
  _i18nQueued = true;
  requestAnimationFrame(function () { _i18nQueued = false; applyStaticHi(); });
}).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
