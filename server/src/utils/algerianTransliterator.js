/**
 * Algerian Civil Status (État Civil Algérien) Arabic-to-French Transliteration Engine
 * Follows official Algerian naming conventions, compound name dictionaries,
 * prefix/suffix processing, and phonetic rules.
 */

// 1. Text Normalization Helpers
function normalizeArabic(text) {
  if (!text || typeof text !== "string") return "";
  let s = text
    .trim()
    // Remove tatweel / kashida
    .replace(/[\u0640]/g, "")
    // Remove Arabic diacritics / harakat
    .replace(/[\u064B-\u065F\u0670]/g, "")
    // Fix common split alef typo (e.g. "أ حمد" -> "أحمد", "إ براهيم" -> "إبراهيم")
    .replace(/\b([أإاآ])\s+([ح-ي])/g, "$1$2")
    // Normalize spaces
    .replace(/\s+/g, " ");

  return s;
}

function stripAlefVariants(text) {
  return text.replace(/[إأآٱ]/g, "ا");
}

// 2. Compound Names Dictionary (Evaluated on full normalized string FIRST)
const COMPOUND_NAMES = {
  // Abd-el / Abder / Abden / etc.
  "عبد القادر": "Abdelkader",
  "عبدالقادر": "Abdelkader",
  "عبد الرحمن": "Abderrahmane",
  "عبدالرحمن": "Abderrahmane",
  "عبد الرحمان": "Abderrahmane",
  "عبدالرحمان": "Abderrahmane",
  "عبد الله": "Abdallah",
  "عبدالله": "Abdallah",
  "عبد العزيز": "Abdelaziz",
  "عبدالعزيز": "Abdelaziz",
  "عبد المولى": "Abdelmoula",
  "عبدالمولى": "Abdelmoula",
  "عبد الحميد": "Abdelhamid",
  "عبدالحميد": "Abdelhamid",
  "عبد المجيد": "Abdelmadjid",
  "عبدالمجيد": "Abdelmadjid",
  "عبد الحفيظ": "Abdelhafid",
  "عبدالحفيظ": "Abdelhafid",
  "عبد الغني": "Abdelghani",
  "عبدالغني": "Abdelghani",
  "عبد الكريم": "Abdelkrim",
  "عبدالكريم": "Abdelkrim",
  "عبد الصمد": "Abdessamed",
  "عبدالصمد": "Abdessamed",
  "عبد السلام": "Abdesselam",
  "عبدالسلام": "Abdesselam",
  "عبد الرزاق": "Abderrezak",
  "عبدالرزاق": "Abderrezak",
  "عبد الوهاب": "Abdelouahab",
  "عبدالوهاب": "Abdelouahab",
  "عبد النور": "Abdennour",
  "عبدالنور": "Abdennour",
  "عبد الحق": "Abdelhak",
  "عبدالحق": "Abdelhak",
  "عبد اللطيف": "Abdellatif",
  "عبداللطيف": "Abdellatif",
  "عبد المالك": "Abdelmalek",
  "عبدالمالك": "Abdelmalek",
  "عبد المؤمن": "Abdelmoumene",
  "عبدالمؤمن": "Abdelmoumene",
  "عبد المومن": "Abdelmoumene",
  "عبد الباسط": "Abdelbasset",
  "عبدالباسط": "Abdelbasset",
  "عبد الجليل": "Abdeldjalil",
  "عبدالجليل": "Abdeldjalil",
  "عبد الحليم": "Abdelhalim",
  "عبدالحليم": "Abdelhalim",
  "عبد الرؤوف": "Abderraouf",
  "عبدالرؤوف": "Abderraouf",
  "عبد الفتاح": "Abdelfettah",
  "عبدالفتاح": "Abdelfettah",
  "عبد الحكيم": "Abdelhakim",
  "عبدالحكيم": "Abdelhakim",
  "عبد الهادي": "Abdelhadi",
  "عبدالهادي": "Abdelhadi",
  "عبد الغفور": "Abdelghafour",
  "عبدالغفور": "Abdelghafour",
  "عبد الباقي": "Abdelbaki",
  "عبدالباقي": "Abdelbaki",
  "عبد الباري": "Abdelbari",
  "عبدالباري": "Abdelbari",
  "عبد الرشيد": "Abderrachid",
  "عبدالرشيد": "Abderrachid",
  "عبد الغفار": "Abdelghaffar",
  "عبدالغفار": "Abdelghaffar",
  "عبد الواحد": "Abdelouahed",
  "عبدالواحد": "Abdelouahed",
  "عبد الودود": "Abdelouadoud",
  "عبدالودود": "Abdelouadoud",
  "عبد القهار": "Abdelkahar",
  "عبدالقهار": "Abdelkahar",
  "عبد الستار": "Abdelsettar",
  "عبدالستار": "Abdelsettar",
  "عبد الجبار": "Abdeldjabbar",
  "عبدالجبار": "Abdeldjabbar",
  "عبد المنعم": "Abdelmounaim",
  "عبدالمنعم": "Abdelmounaim",
  "عبد المجيب": "Abdelmoudjib",
  "عبدالمجيب": "Abdelmoudjib",
  "عبد القوي": "Abdelkaoui",
  "عبدالقوي": "Abdelkaoui",
  "عبد المنان": "Abdelmennan",
  "عبدالمنان": "Abdelmennan",
  "عبد الجواد": "Abdeldjawad",
  "عبدالجواد": "Abdeldjawad",
  "عبد الخالق": "Abdelkhalek",
  "عبدالخالق": "Abdelkhalek",
  "عبد الحي": "Abdelhay",
  "عبدالحي": "Abdelhay",
  "عبد القيوم": "Abdelkayoum",
  "عبدالقيوم": "Abdelkayoum",
  "عبد الوهيد": "Abdelouahid",
  "عبدالوهيد": "Abdelouahid",
  "عبد الصبور": "Abdessabour",
  "عبدالصبور": "Abdessabour",
  "عبد الرحيم": "Abderrahim",
  "عبدالرحيم": "Abderrahim",

  // Sid / Sidi compounds
  "سيد أحمد": "Sid Ahmed",
  "سيداحمد": "Sid Ahmed",
  "سيد علي": "Sid Ali",
  "سيدعلي": "Sid Ali",
  "سيدي أحمد": "Sidi Ahmed",
  "سيدياحمد": "Sidi Ahmed",
  "سيدي محمد": "Sidi Mohamed",
  "سيد محمد": "Sid Mohamed",

  // Din compounds
  "زين الدين": "Zine Eddine",
  "زينالدين": "Zine Eddine",
  "نور الدين": "Noureddine",
  "نورالدين": "Noureddine",
  "عز الدين": "Azzedine",
  "عزالدين": "Azzedine",
  "صلاح الدين": "Salaheddine",
  "صلاحالدين": "Salaheddine",
  "جمال الدين": "Djamel Eddine",
  "جمالالدين": "Djamel Eddine",
  "بدر الدين": "Badreddine",
  "بدرالدين": "Badreddine",
  "سيف الدين": "Seif Eddine",
  "سيفالدين": "Seif Eddine",
  "نصر الدين": "Nasreddine",
  "نصرالدين": "Nasreddine",
  "شمس الدين": "Chemseddine",
  "شمسالدين": "Chemseddine",
  "خير الدين": "Kheireddine",
  "خيرالدين": "Kheireddine",
  "عماد الدين": "Imadeddine",
  "عمادالدين": "Imadeddine",
  "حسام الدين": "Hossameddine",
  "حسامالدين": "Hossameddine",
  "تقي الدين": "Taqieddine",
  "تقيالدين": "Taqieddine",
  "علاء الدين": "Alaeddine",
  "علاءالدين": "Alaeddine",
  "ضياء الدين": "Dhiaeddine",
  "ضياءالدين": "Dhiaeddine",
  "محي الدين": "Mohieddine",
  "محيالدين": "Mohieddine",
  "شرف الدين": "Charafeddine",
  "شرفالدين": "Charafeddine",
  "كمال الدين": "Kamel Eddine",

  // Allah compounds
  "غلام الله": "Ghlamallah",
  "جاب الله": "Djaballah",
  "عطا الله": "Atallah",
  "نصر الله": "Nasrallah",
  "فتح الله": "Fethallah",
  "خلف الله": "Khalfallah",
  "رزق الله": "Rezkallah",
  "خير الله": "Kheirallah",
  "ضيف الله": "Deifallah",
  "عون الله": "Aounallah",
  "أمان الله": "Amanallah",
  "امان الله": "Amanallah",
  "نور الله": "Nourallah",
  "حبيب الله": "Habiballah",
  "سعد الله": "Saadallah",
  "برك الله": "Barkallah",
  "بركة الله": "Barkallah",
  "نعمة الله": "Nematallah",
  "فرج الله": "Faradjallah",

  // Multi-word Algerian Civil Status names
  "فاطمة الزهراء": "Fatima Zohra",
  "فاطمة الزهرة": "Fatima Zohra",
  "فاطمة زهرة": "Fatima Zohra",
  "فاطمة زوهير": "Fatima Zouhir",
  "فاطمة الزهرا": "Fatima Zohra",
  "حافظ الأسد": "Hafed El Assad",
  "حاج علي": "Hadj Ali",
  "بابا علي": "Baba Ali",
  "ولد علي": "Ould Ali",
  "ابن علي": "Ibn Ali",
  "أبو بكر": "Abou Bakr",
  "ابو بكر": "Abou Bakr",
  "نور الهدى": "Nour El Houda",
  "قطر الندى": "Katr Ennada",
  "نور الامل": "Nour El Amal",
  "نور الأمل": "Nour El Amal",
  "نور اليقين": "Nour El Yakine",
  "أم الخير": "Oum El Kheir",
  "ام الخير": "Oum El Kheir",
  "محمد أمين": "Mohamed Amine",
  "محمد امين": "Mohamed Amine",
  "محمد الامين": "Mohamed El Amine",
  "محمد الأمين": "Mohamed El Amine",
  "محمد رضا": "Mohamed Reda",
  "محمد اسلام": "Mohamed Islam",
  "محمد إسلام": "Mohamed Islam",
  "محمد ايمن": "Mohamed Aymen",
  "محمد أيمن": "Mohamed Aymen",
  "محمد انيس": "Mohamed Anis",
  "محمد أنيس": "Mohamed Anis",
  "محمد الياس": "Mohamed Ilyes",
  "محمد إلياس": "Mohamed Ilyes",
  "محمد ياسين": "Mohamed Yacine",
  "محمد المهدي": "Mohamed El Mahdi",
  "محمد نذير": "Mohamed Nadhir",
  "محمد فوزي": "Mohamed Faouzi",
  "محمد فؤاد": "Mohamed Fouad",
  "محمد الصالح": "Mohamed Salah",
  "محمد الشريف": "Mohamed Cherif",
  "محمد الطاهر": "Mohamed Tahar",
  "محمد العربي": "Mohamed Larbi",
  "محمد الهادي": "Mohamed El Hadi",
  "أحمد أمين": "Ahmed Amine",
  "احمد امين": "Ahmed Amine",
  "أحمد ياسين": "Ahmed Yacine"
};

// 3. Comprehensive Dictionary of Algerian First Names & Surnames
const DICTIONARY = {
  // Common Structural Particles
  "بن": "Ben",
  "ابن": "Ibn",
  "بنت": "Bent",
  "ولد": "Ould",
  "بو": "Bou",
  "بل": "Bel",
  "آيت": "Ait",
  "ايت": "Ait",
  "أولاد": "Ouled",
  "اولاد": "Ouled",
  "سيدي": "Sidi",
  "سيد": "Sid",
  "حاج": "Hadj",
  "الحاج": "El Hadj",
  "بابا": "Baba",
  "سي": "Si",
  "لالة": "Lalla",
  "أبو": "Abou",
  "ابو": "Abou",
  "عبد": "Abdel",
  "الله": "Allah",
  "الدين": "Eddine",
  "القادر": "Kader",
  "الرحمان": "Errahmane",
  "الرحمن": "Errahmane",
  "العزيز": "El Aziz",
  "الحميد": "El Hamid",
  "الكريم": "El Krim",
  "الهادي": "El Hadi",
  "العيد": "El Aid",
  "السلام": "Esselam",

  // Masculine Given Names
  "محمد": "Mohamed",
  "امحمد": "M'hamed",
  "أمحمد": "M'hamed",
  "أحمد": "Ahmed",
  "احمد": "Ahmed",
  "محمود": "Mahmoud",
  "مصطفى": "Mustapha",
  "إبراهيم": "Brahim",
  "ابراهيم": "Brahim",
  "إسماعيل": "Ismail",
  "اسماعيل": "Ismail",
  "إسماعين": "Ismail",
  "اسماعين": "Ismail",
  "يوسف": "Youcef",
  "ياسين": "Yacine",
  "يحيى": "Yahia",
  "يحي": "Yahia",
  "عيسى": "Aissa",
  "سليمان": "Slimane",
  "عثمان": "Othmane",
  "عمر": "Omar",
  "علي": "Ali",
  "حسان": "Hassane",
  "حسين": "Houcine",
  "جمال": "Djamel",
  "جلول": "Djelloul",
  "جيلالي": "Djilali",
  "الجيلالي": "El Djilali",
  "مراد": "Mourad",
  "وليد": "Oualid",
  "كريم": "Karim",
  "حكيم": "Hakim",
  "سمير": "Samir",
  "نبيل": "Nabil",
  "فريد": "Farid",
  "رشيد": "Rachid",
  "سعيد": "Said",
  "حميد": "Hamid",
  "مجيد": "Madjid",
  "لزهر": "Lazhar",
  "لخضر": "Lakhdar",
  "العربي": "Larbi",
  "عربي": "Arbi",
  "الطاهر": "Tahar",
  "طاهر": "Tahar",
  "الطيب": "Tayeb",
  "طيب": "Tayeb",
  "ميلود": "Miloud",
  "معمر": "Maamar",
  "بغداد": "Baghdad",
  "شعبان": "Chaabane",
  "رمضان": "Ramdane",
  "قدور": "Kaddour",
  "بوعلام": "Boualem",
  "مبروك": "Mebrouk",
  "مسعود": "Messaoud",
  "خالد": "Khaled",
  "كمال": "Kamel",
  "سفيان": "Soufiane",
  "توفيق": "Toufik",
  "رابح": "Rabah",
  "حمزة": "Hamza",
  "بلال": "Bilel",
  "طارق": "Tarek",
  "منير": "Mounir",
  "حفيظ": "Hafid",
  "إلياس": "Ilyes",
  "الياس": "Ilyes",
  "أمين": "Amine",
  "امين": "Amine",
  "أيمن": "Aymen",
  "ايمن": "Aymen",
  "عادل": "Adel",
  "رضا": "Reda",
  "صابر": "Saber",
  "مهدي": "Mehdi",
  "المهدي": "El Mahdi",
  "رياض": "Riad",
  "هشام": "Hicham",
  "دحمان": "Dahmane",
  "موسى": "Moussa",
  "بشير": "Bachir",
  "قويدر": "Kouider",
  "خيثر": "Kheither",
  "خليج": "Khelidj",
  "ميس": "Meis",
  "شارف": "Charef",
  "صابي": "Sabi",
  "عايد": "Ayed",
  "عياد": "Ayad",
  "بوزيان": "Bouziane",
  "زوبير": "Zoubir",
  "رضوان": "Redouane",
  "فؤاد": "Fouad",
  "منصور": "Mansour",
  "الهواري": "El Houari",
  "هواري": "Houari",
  "بلقاسم": "Belkacem",
  "بدر": "Bader",
  "زيان": "Ziane",
  "الحشدي": "El Hachedi",
  "عياش": "Ayache",
  "الصادق": "Saddek",
  "صادق": "Saddek",
  "صالح": "Salah",
  "الهاشمي": "El Hachemi",
  "هاشمي": "Hachemi",
  "مخلوف": "Makhlouf",
  "بلعيد": "Belaid",
  "قاسم": "Kacem",
  "عمار": "Ammar",
  "سالم": "Salem",
  "داود": "Daoud",
  "قادة": "Kada",
  "عدة": "Adda",
  "عودة": "Aouda",
  "عابد": "Abed",
  "حبيب": "Habib",
  "ناصر": "Nacer",
  "مختار": "Mokhtar",
  "مخطار": "Mokhtar",
  "عامر": "Ameur",
  "حمو": "Hammou",
  "بكر": "Bakr",
  "فوزي": "Faouzi",
  "لحسن": "Lahcene",
  "حمدان": "Hamdane",
  "عباس": "Abbas",
  "عمور": "Ammour",
  "غالي": "Ghali",
  "ماحي": "Mahi",
  "محي": "Mahi",
  "ميسوم": "Missoum",
  "مقدم": "Mokaddem",
  "مالك": "Malek",
  "مولاي": "Moulay",
  "زهير": "Zouhir",
  "شريف": "Cherif",
  "علال": "Allal",
  "سايح": "Sayah",
  "بومدين": "Boumediene",
  "بوعزة": "Bouazza",
  "بولنوار": "Boulenouar",
  "بومعزة": "Boumaaza",
  "طالب": "Taleb",
  "مدوار": "Medouar",

  // Female First Names
  "فاطمة": "Fatima",
  "فاطيمة": "Fatima",
  "الزهراء": "Zohra",
  "الزهرة": "Zohra",
  "زهرة": "Zohra",
  "خيرة": "Kheira",
  "فتيحة": "Fatiha",
  "عائشة": "Aicha",
  "خديجة": "Khadidja",
  "نعيمة": "Naima",
  "مليكة": "Malika",
  "حورية": "Houria",
  "حليمة": "Halima",
  "يمينة": "Yamina",
  "كريمة": "Karima",
  "سعاد": "Souad",
  "فضيلة": "Fadhila",
  "سارة": "Sara",
  "ساره": "Sara",
  "دليلة": "Dalila",
  "آية": "Aya",
  "اية": "Aya",
  "لينة": "Lina",
  "لينا": "Lina",
  "جهان": "Djihan",
  "جيهان": "Djihan",
  "سهام": "Sihem",
  "بختة": "Bakhta",
  "نجاة": "Nadjat",
  "رودينة": "Roudaina",
  "ملاك": "Malek",
  "نوال": "Naouel",
  "شريفة": "Cherifa",
  "مسعودة": "Messaouda",
  "سميرة": "Samira",
  "آمال": "Amel",
  "امال": "Amel",
  "أمال": "Amel",
  "إيمان": "Imene",
  "ايمان": "Imene",
  "إكرام": "Ikram",
  "اكرام": "Ikram",
  "مريم": "Meriem",
  "هاجر": "Hadjer",
  "هاجيرة": "Hadjira",
  "أسماء": "Asma",
  "اسماء": "Asma",
  "نسرين": "Nesrine",
  "ياسمين": "Yasmine",
  "يسمينة": "Yasmine",
  "ياسمينة": "Yasmine",
  "صبرينة": "Sabrina",
  "صابرين": "Sabrine",
  "وهيبة": "Ouahiba",
  "حفيظة": "Hafida",
  "لطيفة": "Latifa",
  "غنية": "Ghania",
  "تركية": "Torkia",
  "زوليخة": "Zoulikha",
  "زهية": "Zahia",
  "حبيبة": "Habiba",
  "نادية": "Nadia",
  "صليحة": "Saliha",
  "حنان": "Hanane",
  "وفاء": "Ouafa",
  "ابتسام": "Ibtissem",
  "أنيسة": "Anissa",
  "انيسة": "Anissa",
  "نورة": "Noura",
  "نورية": "Nouria",
  "راضية": "Radia",
  "شفيقة": "Chafika",
  "حسينة": "Hassina",
  "فايزة": "Faiza",
  "لويزة": "Louiza",
  "كلثوم": "Keltoum",
  "نصيرة": "Nassira",
  "ليلى": "Leila",
  "ميمونة": "Maimouna",
  "سامية": "Samia",
  "زورة": "Zoura",
  "خضرة": "Khadra",
  "صورية": "Souria",
  "حميدة": "Hamida",
  "صباح": "Sabah",
  "حكيمة": "Hakima",
  "منية": "Mounia",
  "لمياء": "Lamia",
  "سهيلة": "Souhila",
  "رجاء": "Radjaa",
  "دنيا": "Dounia",
  "سلمى": "Salma",
  "بشرى": "Bouchra",
  "أحلام": "Ahlem",
  "احلام": "Ahlem",
  "إلهام": "Ilhem",
  "الهام": "Ilhem",
  "فريدة": "Farida",
  "نبيلة": "Nabila",
  "نزهة": "Nezha",
  "عزيزة": "Aziza",
  "جميلة": "Djamila",
  "سليمة": "Salima",
  "نجوى": "Nedjwa",
  "أسمهان": "Asmahan",
  "فوزية": "Faouzia",
  "مخطارية": "Mokhtaria",
  "خالدية": "Khaldia",
  "رشيدة": "Rachida",
  "حياة": "Hayat",
  "زوبيدة": "Zoubida",
  "نسيمة": "Nassima",
  "أمينة": "Amina",
  "امينة": "Amina",
  "زينب": "Zineb",
  "سعيدة": "Saida",
  "رقية": "Roukia",
  "سمية": "Soumia",
  "شهرزاد": "Chahrazed",
  "ربيعة": "Rabia",
  "العالية": "El Alia",
  "حاجة": "Hadja",
  "سعدية": "Saadia",
  "عوالي": "Aouali",
  "عقيلة": "Akila",
  "وسيلة": "Ouassila",
  "هجيرة": "Hadjira",
  "رزيقة": "Razika",
  "سعدة": "Saada",
  "طيبة": "Taiba",
  "فريحة": "Feriha",
  "أسيا": "Assia",
  "اسيا": "Assia",
  "محجوبة": "Mahjouba",
  "كوثر": "Kaouther",
  "بدرة": "Badra",
  "نور": "Nour",

  // Surnames and Tribe / Geographic Names
  "شرماط": "Chermat",
  "قداري": "Keddari",
  "كريمي": "Krimi",
  "بلحاج": "Belhadj",
  "غماري": "Ghomari",
  "خليفة": "Khelifa",
  "غزالي": "Ghezali",
  "حدو": "Haddou",
  "مداني": "Medani",
  "زقاوي": "Zeggaoui",
  "صبايحية": "Sbaihia",
  "دامرجي": "Damerdji",
  "بوراس": "Bouras",
  "مختاري": "Mokhtari",
  "رمضاني": "Ramdani",
  "بوجلة": "Boudjella",
  "محمودي": "Mahmoudi",
  "بطاهر": "Bataher",
  "برابح": "Brabeh",
  "معزوزي": "Maazouzi",
  "بلعباس": "Belabbes",
  "تومي": "Toumi",
  "داودي": "Daoudi",
  "دحماني": "Dahmani",
  "دقيش": "Deguiche",
  "زرودي": "Zerroudi",
  "زيتوني": "Zitouni",
  "عزوز": "Azzouz",
  "قرماش": "Ghermach",
  "مزيان": "Meziane",
  "بلهواري": "Belhouari",
  "جميل": "Djamil",
  "حسون": "Hassoun",
  "حمادي": "Hammadi",
  "حمداني": "Hamdani",
  "حميدي": "Hamidi",
  "حميش": "Hamiche",
  "خرباش": "Kherbach",
  "خربة": "Kherba",
  "خوجة": "Khoudja",
  "سليماني": "Slimani",
  "طاهري": "Taheri",
  "بوريشة": "Bouricha",
  "حدوش": "Haddouche",
  "بريك": "Brik",
  "يخلف": "Yakhlef",
  "عراب": "Arrab",
  "بزة": "Bazza",
  "بوشاقور": "Bouchakour",
  "عثماني": "Othmani",
  "بوعبيدي": "Bouabaidi",
  "لكحل": "Lekhal",
  "شويق": "Chouik",
  "بوسعيد": "Boussaid",
  "مرابط": "Merabet",
  "ساعد": "Saed",
  "رحماني": "Rahmani",
  "الرحماني": "Errahmani",
  "براهيمي": "Brahimi",
  "ابراهيمي": "Brahimi",
  "إبراهيمي": "Brahimi",
  "بلقاسمي": "Belkacemi",
  "عياشي": "Ayachi",
  "علالي": "Allali",
  "قاسمي": "Kacemi",
  "فرحات": "Farhat",
  "بوزيد": "Bouzid",
  "معوش": "Maouche",
  "عيساوي": "Aissaoui",
  "يوسفي": "Youssefi",
  "دراجي": "Derradji",
  "لعرابي": "Larabi",
  "ميباركي": "Mebarki",
  "بناني": "Bennani",
  "عمارة": "Amara",
  "لعمارة": "Lamara",
  "ساسي": "Sassi",
  "صالحي": "Salahi",
  "قاسي": "Kassi",
  "بدراني": "Badrani",
  "عوفي": "Aoufi",
  "بوناب": "Bounab",
  "قادري": "Kadri",
  "قوادري": "Kouadri",
  "مقداد": "Mekdad",
  "عبيد": "Abeid",
  "شابو": "Chabou",
  "شاوش": "Chaouche",
  "عمران": "Amrane",
  "عمراني": "Amrani",
  "هني": "Henni",
  "سحنون": "Sahnoun",
  "لزرق": "Lazreg",
  "زروقي": "Zerrouki",
  "سعدي": "Saadi",
  "سعداوي": "Saadaoui",
  "فراح": "Farah",
  "مداح": "Meddah",
  "صحراوي": "Sahraoui",
  "عزي": "Azzi",
  "عز": "Azz",
  "غلام": "Ghlam",
  "بلعربي": "Belarbi",
  "عبدي": "Abdi",
  "بوجلطية": "Boudjeltia",
  "الحبيب": "El Habib",
  "حريشان": "Harichane",
  "رباحي": "Rabahi",
  "رحمون": "Rahmoune",
  "سنوسي": "Senoussi",
  "صدوقي": "Seddouki",
  "صديقي": "Sediki",
  "قدوري": "Kaddouri",
  "لعريبي": "Laribi",
  "محمدي": "Mohammedi",
  "مقاوشة": "Mekaoucha",
  "يحياوي": "Yahiaoui",
  "بلقايد": "Belkaid",
  "بلقراوة": "Belkaraoua",
  "بلعظم": "Beladham",
  "بلغازي": "Belghazi",
  "باشا": "Bacha",
  "أخضري": "Akhdari",
  "اخضري": "Akhdari",
  "أديب": "Adib",
  "اديب": "Adib",
  "مزاري": "Mezari",
  "إزيان": "Iziane",
  "ازيان": "Iziane",
  "أمزرت": "Amzart",
  "أنديش": "Andich",
  "أولعربي": "Oularbi",
  "اولعربي": "Oularbi",
  "الاعرج": "El Aredj",
  "الأعرج": "El Aredj",
  "البـرادعـة": "El Brada",
  "البرادعة": "El Brada",
  "البراهمي": "El Brahmi",
  "اسماعيلي": "Ismaili",
  "شوية": "Chouia"
};

// 4. Common Algerian Prefix Handlers
function handlePrefixes(word) {
  // بن / ابن
  if (word.startsWith("بن ") || word.startsWith("ابن ")) {
    const rest = word.replace(/^(بن |ابن )/, "").trim();
    return "Ben " + transliterateSingleWord(rest);
  }
  if (word.startsWith("بن") && word.length > 4 && !word.startsWith("بنت")) {
    const rest = word.slice(2);
    return "Ben " + transliterateSingleWord(rest);
  }

  // بو
  if (word.startsWith("بو ") || word.startsWith("بو")) {
    const rest = word.startsWith("بو ") ? word.slice(3) : word.slice(2);
    if (rest.length >= 2) {
      return "Bou" + (word.startsWith("بو ") ? " " : "") + transliterateSingleWord(rest).toLowerCase();
    }
  }

  // بل (Bel)
  if (word.startsWith("بل") && word.length >= 4 && !word.startsWith("بلد")) {
    const rest = word.slice(2);
    return "Bel" + transliterateSingleWord(rest).toLowerCase();
  }

  // أولاد / اولاد
  if (word.startsWith("أولاد ") || word.startsWith("اولاد ")) {
    const rest = word.replace(/^(أولاد |اولاد )/, "").trim();
    return "Ouled " + transliterateSingleWord(rest);
  }

  // آيت / ايت
  if (word.startsWith("آيت ") || word.startsWith("ايت ")) {
    const rest = word.replace(/^(آيت |ايت )/, "").trim();
    return "Ait " + transliterateSingleWord(rest);
  }

  // ال (El)
  if (word.startsWith("ال") && word.length > 3) {
    const rest = word.slice(2);
    const solarLetters = {
      "ت": "Et ", "ث": "Eth ", "د": "Ed ", "ذ": "Edh ", "ر": "Er ", "ز": "Ez ",
      "س": "Es ", "ش": "Ech ", "ص": "Es ", "ض": "Ed ", "ط": "Et ", "ظ": "Edh ",
      "ل": "El ", "ن": "En "
    };
    const firstChar = rest[0];
    const prefix = solarLetters[firstChar] || "El ";
    return prefix + transliterateSingleWord(rest);
  }

  return null;
}

// 5. Letter-by-Letter Algerian Phonetic Engine
function phoneticTransliterate(word) {
  if (!word) return "";

  // Common Suffixes
  let suffix = "";
  let base = word;

  const suffixes = [
    { ar: "اوي", fr: "aoui" },
    { ar: "اني", fr: "ani" },
    { ar: "اري", fr: "ari" },
    { ar: "وني", fr: "ouni" },
    { ar: "ودي", fr: "oudi" },
    { ar: "اشي", fr: "achi" },
    { ar: "يشي", fr: "ichi" },
    { ar: "اتي", fr: "ati" },
    { ar: "جي", fr: "dji" },
    { ar: "ية", fr: "ia" },
    { ar: "ة", fr: "a" },
    { ar: "ي", fr: "i" },
  ];

  for (const s of suffixes) {
    if (base.endsWith(s.ar) && base.length > s.ar.length + 1) {
      base = base.slice(0, -s.ar.length);
      suffix = s.fr;
      break;
    }
  }

  // Algerian letter mapping
  const charMap = {
    "ا": "a", "أ": "a", "إ": "i", "آ": "a", "ٱ": "a", "ء": "e", "ئ": "e", "ؤ": "ou",
    "ب": "b", "ت": "t", "ث": "th", "ج": "dj", "ح": "h", "خ": "kh", "د": "d",
    "ذ": "dh", "ر": "r", "ز": "z", "س": "s", "ش": "ch", "ص": "s", "ض": "d",
    "ط": "t", "ظ": "dh", "ع": "a", "غ": "gh", "ف": "f", "ق": "k", "ك": "k",
    "ل": "l", "م": "m", "ن": "n", "ه": "h", "و": "ou", "ي": "i", "ى": "a"
  };

  let out = "";
  for (let i = 0; i < base.length; i++) {
    const c = base[i];
    const next = base[i + 1];

    if (c === "ع") {
      out += "a";
    } else if (c === "و") {
      out += "ou";
    } else if (c === "ي") {
      if (i === 0 && (next === "a" || next === "ا" || next === "و" || next === "ou")) {
        out += "y";
      } else {
        out += "i";
      }
    } else if (c === "ق") {
      out += "k";
    } else if (c === "ج") {
      out += "dj";
    } else if (c === "ش") {
      out += "ch";
    } else if (c === "خ") {
      out += "kh";
    } else if (c === "غ") {
      out += "gh";
    } else {
      out += charMap[c] || c;
    }
  }

  let result = out + suffix;
  // Cleanup repeating double vowels or awkward clusters
  result = result
    .replace(/ouou/g, "ou")
    .replace(/iii/g, "i")
    .replace(/aaa/g, "a")
    .replace(/aa/g, "a");

  return result;
}

// 6. Transliterate a single word
function transliterateSingleWord(rawWord) {
  const word = normalizeArabic(rawWord);
  if (!word) return "";

  // 1. Direct dictionary lookup (exact match)
  if (DICTIONARY[word]) return DICTIONARY[word];

  // 2. Direct dictionary lookup with alef variants normalized
  const stripped = stripAlefVariants(word);
  for (const [key, val] of Object.entries(DICTIONARY)) {
    if (stripAlefVariants(key) === stripped) {
      return val;
    }
  }

  // 3. Prefix handler (Ben, Bou, Bel, El, etc.)
  const prefixed = handlePrefixes(word);
  if (prefixed) return prefixed;

  // 4. Fallback to phonetic engine
  const phonetic = phoneticTransliterate(word);
  if (phonetic) {
    return phonetic.charAt(0).toUpperCase() + phonetic.slice(1);
  }

  return word;
}

/**
 * Transliterate an Arabic name phrase (can be 1 or multiple words, or a compound).
 */
function transliteratePhrase(rawPhrase) {
  const norm = normalizeArabic(rawPhrase);
  if (!norm) return "";

  // 1. Check Compound Names Map (whole phrase)
  if (COMPOUND_NAMES[norm]) {
    return COMPOUND_NAMES[norm];
  }

  // Check compound with stripped alef
  const stripped = stripAlefVariants(norm);
  for (const [key, val] of Object.entries(COMPOUND_NAMES)) {
    if (stripAlefVariants(key) === stripped) {
      return val;
    }
  }

  // Check if phrase starts with a known compound (e.g. "عبد القادر أحمد")
  for (const [compound, french] of Object.entries(COMPOUND_NAMES)) {
    if (norm.startsWith(compound + " ")) {
      const rest = norm.slice(compound.length + 1).trim();
      return french + " " + transliteratePhrase(rest);
    }
  }

  // 2. Tokenize by space and transliterate each word
  const words = norm.split(" ").filter(Boolean);
  const parts = [];

  for (let i = 0; i < words.length; i++) {
    const current = words[i];
    const next = words[i + 1];

    // Check 2-word pair in COMPOUND_NAMES first
    if (next) {
      const pair = current + " " + next;
      if (COMPOUND_NAMES[pair]) {
        parts.push(COMPOUND_NAMES[pair]);
        i++; // skip next
        continue;
      }
      if (current === "بن" || current === "ابن") {
        parts.push("Ben " + transliterateSingleWord(next));
        i++; // skip next
        continue;
      }
      if (current === "أبو" || current === "ابو") {
        parts.push("Abou " + transliterateSingleWord(next));
        i++;
        continue;
      }
      if (current === "سيد" || current === "سيدي") {
        parts.push((current === "سيد" ? "Sid " : "Sidi ") + transliterateSingleWord(next));
        i++;
        continue;
      }
      if (current === "آيت" || current === "ايت") {
        parts.push("Ait " + transliterateSingleWord(next));
        i++;
        continue;
      }
      if (current === "أولاد" || current === "اولاد") {
        parts.push("Ouled " + transliterateSingleWord(next));
        i++;
        continue;
      }
    }

    parts.push(transliterateSingleWord(current));
  }

  return parts.join(" ");
}


function transliterateLastName(arabicLastName) {
  if (!arabicLastName) return "";
  const fr = transliteratePhrase(arabicLastName);
  return fr.toUpperCase().trim();
}

/**
 * Transliterate Employee First Name -> Title Case (Civil Status standard)
 * Example: 'دليلة' -> 'Dalila', 'فاطمة الزهراء' -> 'Fatima Zohra'
 */
function transliterateFirstName(arabicFirstName) {
  if (!arabicFirstName) return "";
  const fr = transliteratePhrase(arabicFirstName);
  return fr
    .split(/\s+/)
    .filter(Boolean)
    .map(word => {
      // Preserve uppercase particles if any like M', D', El, Ben, etc.
      if (word.startsWith("M'") || word.startsWith("m'")) {
        return "M'" + (word.slice(2).charAt(0).toUpperCase() + word.slice(3).toLowerCase());
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ")
    .trim();
}

/**
 * Convenience helper for full employee record
 */
function transliterateFullName(lastName, firstName) {
  const lastNameFr = transliterateLastName(lastName);
  const nameFr = transliterateFirstName(firstName);
  const fullNameFr = [lastNameFr, nameFr].filter(Boolean).join(" ");
  return { lastNameFr, nameFr, fullNameFr };
}

module.exports = {
  normalizeArabic,
  transliterateLastName,
  transliterateFirstName,
  transliterateFullName,
  transliteratePhrase,
  COMPOUND_NAMES,
  DICTIONARY
};
