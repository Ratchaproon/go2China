// Immigration and university paperwork guide. The app never fills in or submits
// these forms: it explains what each one is, what you need for it, and links to
// the official government or university page.
//
// Every URL below points to an official government or government-run site.
// Links were checked on 2026-10-14; `unverified` marks sites that block
// automated checks (e.g. Cloudflare) but are the well-known official addresses.

export type Stage = "before_departure" | "on_arrival" | "during_stay" | "before_leaving";
export type StudentType = "degree" | "exchange";
export type StepKind = "immigration" | "university" | "health" | "registration" | "insurance" | "money";

export const STAGES: Stage[] = ["before_departure", "on_arrival", "during_stay", "before_leaving"];

export interface OfficialLink {
  label: string;
  url: string;
  unverified?: boolean;
}

export interface PaperStep {
  id: string;
  stage: Stage;
  kind: StepKind;
  title: string;
  what: string;
  issuer: string;
  documents?: string[];
  when?: string;
  for?: StudentType[];
  /** Only applies to stays longer than this many months. */
  minMonths?: number;
  /** Only applies to stays up to this many months. */
  maxMonths?: number;
  links: OfficialLink[];
}

const HOST_UNI = "Your host university";

// ---------------------------------------------------------------------------
// University steps that apply in every country
// ---------------------------------------------------------------------------

const UNIVERSITY_STEPS: PaperStep[] = [
  {
    id: "uni_nomination", stage: "before_departure", kind: "university", for: ["exchange"],
    title: "Nomination by your home university",
    what: "Your home university's exchange or international office nominates you to the partner university. You usually can't apply to the host before this.",
    issuer: "Your home university", when: "Usually 4–8 months before the semester starts",
    links: [],
  },
  {
    id: "uni_exchange_application", stage: "before_departure", kind: "university", for: ["exchange"],
    title: "Exchange application to the host university",
    what: "After nomination, apply on the host university's exchange portal. The host then issues an acceptance letter, which you need for the visa.",
    issuer: HOST_UNI,
    documents: ["Passport copy", "Transcript", "Nomination confirmation", "Language certificate (if required)", "Study plan"],
    links: [],
  },
  {
    id: "uni_learning_agreement", stage: "before_departure", kind: "university", for: ["exchange"],
    title: "Course pre-approval / learning agreement",
    what: "Agree with your home university which host courses will count for credit, before you go. Without this, credits may not transfer.",
    issuer: "Your home university and host university",
    links: [],
  },
  {
    id: "uni_offer", stage: "before_departure", kind: "university", for: ["degree"],
    title: "Accept your offer and pay the deposit",
    what: "Accept the offer on the university portal and pay any deposit. The university then issues the documents you need for the visa.",
    issuer: HOST_UNI,
    links: [],
  },
  {
    id: "uni_accommodation", stage: "before_departure", kind: "university",
    title: "Apply for accommodation",
    what: "University housing for international students often fills early. Apply as soon as you're accepted.",
    issuer: HOST_UNI,
    links: [],
  },
  {
    id: "uni_checkin", stage: "on_arrival", kind: "university",
    title: "Check in at the international student office",
    what: "Register your arrival, complete enrolment, get your student ID card, and attend orientation. Bring your passport, visa and acceptance letter.",
    issuer: HOST_UNI, when: "Within the first days after arrival",
    links: [],
  },
  {
    id: "uni_course_change", stage: "during_stay", kind: "university", for: ["exchange"],
    title: "Update your learning agreement if courses change",
    what: "If you drop or add courses, get the change approved by both universities so credits still transfer.",
    issuer: "Your home university and host university",
    links: [],
  },
  {
    id: "uni_transcript", stage: "before_leaving", kind: "university", for: ["exchange"],
    title: "Transcript of records and credit transfer",
    what: "Request your transcript from the host university and submit the credit-transfer form at your home university.",
    issuer: "Host university → home university",
    links: [],
  },
  {
    id: "uni_clearance", stage: "before_leaving", kind: "university",
    title: "Check out with the university",
    what: "Return library books and keys, settle any fees, and get a leaving certificate if your visa or scholarship needs one.",
    issuer: HOST_UNI,
    links: [],
  },
  {
    id: "money_leaving", stage: "before_leaving", kind: "money",
    title: "Close accounts and bring your money home",
    what: "Pay final bills, get your deposit back, convert leftover money, and close or keep your local bank account and phone plan. The assistant can compare conversion options for you.",
    issuer: "You",
    links: [],
  },
];

// ---------------------------------------------------------------------------
// Country-specific immigration steps
// ---------------------------------------------------------------------------

const COUNTRY_STEPS: Record<string, PaperStep[]> = {
  CN: [
    {
      id: "cn_jw", stage: "before_departure", kind: "university",
      title: "Admission letter + JW201/JW202 form",
      what: "Your Chinese host university issues the admission letter and the Visa Application for Study in China form (JW201 for scholarship students, JW202 for self-funded students). You need both for the visa.",
      issuer: HOST_UNI,
      links: [{ label: "Study in China (Ministry of Education)", url: "https://studyinchina.edu.cn/" }],
    },
    {
      id: "cn_visa_x1", stage: "before_departure", kind: "immigration", minMonths: 6,
      title: "X1 student visa (stays over 180 days)",
      what: "For stays over 180 days. The X1 visa is valid for 30 days after entry, so you must convert it to a residence permit after arrival.",
      issuer: "Chinese embassy/consulate or Visa Application Service Center",
      documents: ["Passport valid 6+ months with blank pages", "Admission letter", "JW201 or JW202 (original)", "Online visa application form (COVA)", "Photo", "Physical Examination Record for Foreigner (often required)"],
      links: [
        { label: "Online visa application form (COVA)", url: "https://consular.mfa.gov.cn/VISA/" },
        { label: "China Visa Application Service Center", url: "https://www.visaforchina.cn/" },
        { label: "MFA consular service", url: "https://cs.mfa.gov.cn/" },
      ],
    },
    {
      id: "cn_visa_x2", stage: "before_departure", kind: "immigration", maxMonths: 6,
      title: "X2 student visa (stays up to 180 days)",
      what: "For short programmes and one-semester exchanges up to 180 days. The stay length is printed on the visa; no residence permit is needed.",
      issuer: "Chinese embassy/consulate or Visa Application Service Center",
      documents: ["Passport valid 6+ months", "Admission letter", "JW202 (if issued)", "Online visa application form (COVA)", "Photo"],
      links: [
        { label: "Online visa application form (COVA)", url: "https://consular.mfa.gov.cn/VISA/" },
        { label: "China Visa Application Service Center", url: "https://www.visaforchina.cn/" },
      ],
    },
    {
      id: "cn_arrival_card", stage: "on_arrival", kind: "immigration",
      title: "Arrival card",
      what: "Fill in the foreigner arrival card online before your flight, or on paper at the airport.",
      issuer: "National Immigration Administration",
      links: [{ label: "Online arrival card (NIA)", url: "https://s.nia.gov.cn/ArrivalCardFillingPC/" }],
    },
    {
      id: "cn_registration", stage: "on_arrival", kind: "registration",
      title: "Accommodation registration with the police",
      what: "Register where you live with the local police station within 24 hours of arrival. University dorms usually do this for you; if you rent privately, go with your landlord. Keep the registration slip, as you need it for the residence permit.",
      issuer: "Local public security bureau (police)", when: "Within 24 hours",
      links: [{ label: "National Immigration Administration", url: "https://en.nia.gov.cn/" }],
    },
    {
      id: "cn_health_check", stage: "on_arrival", kind: "health", minMonths: 6,
      title: "Health check verification",
      what: "Get a health check or have your home-country medical report verified at the local designated international travel health center. The residence permit needs it.",
      issuer: "Local International Travel Healthcare Center",
      links: [],
    },
    {
      id: "cn_residence_permit", stage: "on_arrival", kind: "immigration", minMonths: 6,
      title: "Residence permit for study",
      what: "Convert your X1 visa into a residence permit at the local Exit-Entry Administration within 30 days of arrival. The international office usually helps with the forms. Your passport may be held for up to about 2 weeks.",
      issuer: "Local Exit-Entry Administration (Public Security Bureau)",
      documents: ["Passport and X1 visa", "JW201/JW202", "Admission letter", "Accommodation registration slip", "Health check verification", "Photos", "Application form (from the office or university)"],
      when: "Within 30 days of entry",
      links: [{ label: "National Immigration Administration", url: "https://en.nia.gov.cn/" }],
    },
    {
      id: "cn_insurance", stage: "on_arrival", kind: "insurance",
      title: "Student health insurance",
      what: "Chinese universities require international students to hold health insurance, often a plan bought through the university. Check whether your own insurance is accepted.",
      issuer: HOST_UNI,
      links: [],
    },
    {
      id: "cn_parttime", stage: "during_stay", kind: "immigration",
      title: "Permission for part-time work or internships",
      what: "Off-campus part-time work and internships need approval from your university and an annotation on your residence permit. Working without it can lead to fines or deportation.",
      issuer: "University + Exit-Entry Administration",
      links: [{ label: "National Immigration Administration", url: "https://en.nia.gov.cn/" }],
    },
    {
      id: "cn_extension", stage: "during_stay", kind: "immigration",
      title: "Extend your visa or residence permit",
      what: "If your studies continue, apply for an extension before your permit expires. Applications usually open about 30 days before expiry.",
      issuer: "Local Exit-Entry Administration",
      links: [{ label: "National Immigration Administration", url: "https://en.nia.gov.cn/" }],
    },
    {
      id: "cn_leaving", stage: "before_leaving", kind: "immigration",
      title: "Leave before your visa or permit expires",
      what: "Check the expiry date of your visa or residence permit and leave before it. Overstaying leads to fines and can affect future visas.",
      issuer: "National Immigration Administration",
      links: [{ label: "National Immigration Administration", url: "https://en.nia.gov.cn/" }],
    },
  ],

  JP: [
    {
      id: "jp_coe", stage: "before_departure", kind: "immigration",
      title: "Certificate of Eligibility (COE)",
      what: "Your Japanese university applies for the COE on your behalf at the Immigration Services Agency. You send them the documents they ask for, then receive the COE (paper or e-mail).",
      issuer: "Immigration Services Agency (via your university)",
      links: [
        { label: "COE application (ISA, Japanese)", url: "https://www.moj.go.jp/isa/applications/procedures/16-1.html" },
        { label: "Immigration Services Agency (English)", url: "https://www.isa.go.jp/en/" },
      ],
    },
    {
      id: "jp_visa", stage: "before_departure", kind: "immigration",
      title: "Student visa at the Japanese embassy",
      what: "Apply for the 'Student' visa at the Japanese embassy or consulate in your country with your COE.",
      issuer: "Embassy/consulate of Japan",
      documents: ["Passport", "COE", "Visa application form", "Photo"],
      links: [{ label: "Visa information (MOFA)", url: "https://www.mofa.go.jp/j_info/visit/visa/index.html", unverified: true }],
    },
    {
      id: "jp_residence_card", stage: "on_arrival", kind: "immigration",
      title: "Residence card at the airport",
      what: "Major airports issue your residence card on arrival. Carry it at all times.",
      issuer: "Immigration Services Agency",
      links: [{ label: "Status of residence 'Student' (ISA, Japanese)", url: "https://www.moj.go.jp/isa/applications/status/student.html" }],
    },
    {
      id: "jp_address", stage: "on_arrival", kind: "registration",
      title: "Register your address at the city office",
      what: "Register your address at the city or ward office within 14 days of moving in. Enrol in National Health Insurance and the pension system at the same time.",
      issuer: "City/ward office", when: "Within 14 days",
      links: [],
    },
    {
      id: "jp_work_permission", stage: "on_arrival", kind: "immigration",
      title: "Permission for part-time work",
      what: "Students need 'Permission to engage in activity other than that permitted' to work part-time, usually up to 28 hours a week. You can apply at the airport on arrival.",
      issuer: "Immigration Services Agency",
      links: [{ label: "Status of residence 'Student' (ISA, Japanese)", url: "https://www.moj.go.jp/isa/applications/status/student.html" }],
    },
    {
      id: "jp_support", stage: "during_stay", kind: "university",
      title: "Scholarships and student support",
      what: "JASSO runs scholarships and support programmes for international students.",
      issuer: "JASSO",
      links: [
        { label: "JASSO", url: "https://www.jasso.go.jp/en/" },
        { label: "Study in Japan", url: "https://www.studyinjapan.go.jp/en/" },
      ],
    },
  ],

  KR: [
    {
      id: "kr_visa", stage: "before_departure", kind: "immigration",
      title: "D-2 student visa",
      what: "Degree and exchange students usually get a D-2 visa (exchange students: D-2-6). Apply at the Korean embassy, or online through the Korea Visa Portal if your university sponsors it.",
      issuer: "Korean embassy / Korea Visa Portal",
      documents: ["Passport", "Certificate of admission", "Proof of finances", "Visa application form", "Photo"],
      links: [
        { label: "Korea Visa Portal", url: "https://www.visa.go.kr/" },
        { label: "Study in Korea", url: "https://www.studyinkorea.go.kr/" },
      ],
    },
    {
      id: "kr_arc", stage: "on_arrival", kind: "immigration", minMonths: 3,
      title: "Alien Registration Card (ARC)",
      what: "If you stay more than 90 days, register within 90 days of arrival. Book an appointment at the immigration office on HiKorea.",
      issuer: "Korea Immigration Service", when: "Within 90 days",
      links: [{ label: "HiKorea", url: "https://www.hikorea.go.kr/" }],
    },
    {
      id: "kr_work", stage: "during_stay", kind: "immigration",
      title: "Permission for part-time work",
      what: "D-2 students need permission from immigration (with university approval) before working part-time.",
      issuer: "Korea Immigration Service",
      links: [{ label: "HiKorea", url: "https://www.hikorea.go.kr/" }],
    },
  ],

  GB: [
    {
      id: "gb_cas", stage: "before_departure", kind: "university", minMonths: 6,
      title: "Confirmation of Acceptance for Studies (CAS)",
      what: "Your university issues a CAS reference number after you accept an unconditional offer (and often pay a deposit). You need it for the Student visa.",
      issuer: HOST_UNI,
      links: [{ label: "Student visa: documents you must provide", url: "https://www.gov.uk/student-visa/documents-you-must-provide" }],
    },
    {
      id: "gb_visitor", stage: "before_departure", kind: "immigration", maxMonths: 6,
      title: "Short study: Standard Visitor",
      what: "Study of up to 6 months can often be done as a Standard Visitor instead of a Student visa. Check with your university which route your exchange needs.",
      issuer: "UK Visas and Immigration",
      links: [{ label: "Standard Visitor visa", url: "https://www.gov.uk/standard-visitor" }],
    },
    {
      id: "gb_visa", stage: "before_departure", kind: "immigration", minMonths: 6,
      title: "Student visa",
      what: "Apply online, pay the visa fee and the Immigration Health Surcharge, and prove your identity. Some courses also need ATAS clearance, and applicants from some countries need a TB test.",
      issuer: "UK Visas and Immigration",
      links: [
        { label: "Student visa", url: "https://www.gov.uk/student-visa" },
        { label: "Immigration Health Surcharge", url: "https://www.gov.uk/healthcare-immigration-application" },
        { label: "ATAS", url: "https://www.gov.uk/guidance/academic-technology-approval-scheme" },
        { label: "TB test", url: "https://www.gov.uk/tb-test-visa" },
      ],
    },
    {
      id: "gb_evisa", stage: "on_arrival", kind: "immigration",
      title: "Check your eVisa",
      what: "Your immigration status is digital. Make sure your UKVI account is linked to your current passport, and use it to prove your right to study or rent.",
      issuer: "UK Visas and Immigration",
      links: [{ label: "eVisa", url: "https://www.gov.uk/evisa" }],
    },
    {
      id: "gb_gp", stage: "on_arrival", kind: "health",
      title: "Register with a GP (doctor)",
      what: "Register with a local GP surgery soon after arrival.",
      issuer: "NHS",
      links: [{ label: "How to register with a GP (NHS)", url: "https://www.nhs.uk/nhs-services/gps/how-to-register-with-a-gp-surgery/" }],
    },
  ],

  US: [
    {
      id: "us_i20", stage: "before_departure", kind: "university",
      title: "Form I-20 (F-1) or DS-2019 (J-1)",
      what: "Your US university issues the I-20 (F-1 students) or DS-2019 (J-1 exchange visitors) once you're admitted and show proof of funds.",
      issuer: HOST_UNI,
      links: [{ label: "Students and the Form I-20 (Study in the States)", url: "https://studyinthestates.dhs.gov/students/prepare/students-and-the-form-i-20" }],
    },
    {
      id: "us_sevis", stage: "before_departure", kind: "immigration",
      title: "Pay the SEVIS I-901 fee",
      what: "Pay the SEVIS fee before your visa interview and keep the receipt.",
      issuer: "US Department of Homeland Security",
      links: [{ label: "SEVIS I-901 fee payment", url: "https://www.fmjfee.com/" }],
    },
    {
      id: "us_visa", stage: "before_departure", kind: "immigration",
      title: "F-1 or J-1 visa (DS-160 + interview)",
      what: "Complete the DS-160 online form, pay the visa fee, and attend an interview at a US embassy or consulate.",
      issuer: "US Department of State",
      documents: ["Passport", "I-20 or DS-2019", "SEVIS fee receipt", "DS-160 confirmation", "Proof of funds", "Photo"],
      links: [
        { label: "Student visas (travel.state.gov)", url: "https://travel.state.gov/content/travel/en/us-visas/study/student-visa.html", unverified: true },
        { label: "DS-160 online form", url: "https://ceac.state.gov/genniv/", unverified: true },
      ],
    },
    {
      id: "us_i94", stage: "on_arrival", kind: "immigration",
      title: "Check your I-94 record",
      what: "After entry, download your I-94 arrival record and check it shows F-1/J-1 and 'D/S'.",
      issuer: "US Customs and Border Protection",
      links: [{ label: "I-94 website", url: "https://i94.cbp.dhs.gov/" }],
    },
    {
      id: "us_dso", stage: "on_arrival", kind: "university",
      title: "Report to your DSO / international office",
      what: "Check in with your Designated School Official so your SEVIS record is activated. Missing this can end your status.",
      issuer: HOST_UNI,
      links: [{ label: "Study in the States", url: "https://studyinthestates.dhs.gov/students" }],
    },
  ],

  AU: [
    {
      id: "au_coe", stage: "before_departure", kind: "university",
      title: "Confirmation of Enrolment (CoE) and OSHC",
      what: "Your university issues a CoE after you accept the offer. You also need Overseas Student Health Cover for your whole stay.",
      issuer: HOST_UNI,
      links: [{ label: "Overseas Student Health Cover", url: "https://www.privatehealth.gov.au/health_insurance/overseas/overseas_student_health_cover.htm" }],
    },
    {
      id: "au_visa", stage: "before_departure", kind: "immigration",
      title: "Student visa (subclass 500)",
      what: "Apply online in ImmiAccount with your CoE, OSHC, proof of funds and English results.",
      issuer: "Department of Home Affairs",
      links: [
        { label: "Student visa (subclass 500)", url: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500" },
        { label: "ImmiAccount", url: "https://online.immi.gov.au/" },
        { label: "Study Australia", url: "https://www.studyaustralia.gov.au/" },
      ],
    },
  ],

  SG: [
    {
      id: "sg_stp", stage: "before_departure", kind: "immigration",
      title: "Student's Pass application (IPA)",
      what: "Your university registers you in ICA's system; you then complete the online application and receive an In-Principle Approval (IPA) letter.",
      issuer: "Immigration & Checkpoints Authority (ICA)",
      links: [
        { label: "Becoming a Student's Pass holder (ICA)", url: "https://www.ica.gov.sg/reside/STP" },
        { label: "Apply for a Student's Pass", url: "https://www.ica.gov.sg/reside/STP/apply" },
      ],
    },
    {
      id: "sg_stp_issue", stage: "on_arrival", kind: "immigration",
      title: "Complete Student's Pass formalities",
      what: "After arrival, complete the formalities (and medical exam, if required) to get your Student's Pass card.",
      issuer: "ICA",
      links: [{ label: "Becoming a Student's Pass holder (ICA)", url: "https://www.ica.gov.sg/reside/STP" }],
    },
  ],

  MY: [
    {
      id: "my_val", stage: "before_departure", kind: "immigration",
      title: "Student pass application (EMGS)",
      what: "Your university submits your student pass application to Education Malaysia Global Services. You receive an eVAL (visa approval letter) to enter Malaysia.",
      issuer: "Education Malaysia Global Services (EMGS)",
      links: [
        { label: "EMGS student pass portal", url: "https://visa.educationmalaysia.gov.my/" },
        { label: "Education Malaysia", url: "https://educationmalaysia.gov.my/" },
      ],
    },
    {
      id: "my_medical", stage: "on_arrival", kind: "health",
      title: "Medical screening and pass endorsement",
      what: "Complete the post-arrival medical screening at a registered clinic; your university then gets the student pass endorsed in your passport.",
      issuer: "EMGS / your university",
      links: [{ label: "EMGS student pass portal", url: "https://visa.educationmalaysia.gov.my/" }],
    },
  ],

  TH: [
    {
      id: "th_visa", stage: "before_departure", kind: "immigration",
      title: "Non-Immigrant ED visa",
      what: "Apply online with your acceptance letter and the university's letter to immigration.",
      issuer: "Ministry of Foreign Affairs of Thailand",
      links: [{ label: "Thai e-Visa", url: "https://www.thaievisa.go.th/" }],
    },
    {
      id: "th_tm30", stage: "on_arrival", kind: "registration",
      title: "Address notification (TM.30)",
      what: "Your landlord or dorm must report your address to immigration within 24 hours. Ask for a copy, as you need it later.",
      issuer: "Immigration Bureau",
      links: [{ label: "Immigration Bureau", url: "https://www.immigration.go.th/" }],
    },
    {
      id: "th_90day", stage: "during_stay", kind: "immigration",
      title: "90-day reporting",
      what: "Report your address to immigration every 90 days. You can do it online.",
      issuer: "Immigration Bureau",
      links: [{ label: "Online 90-day report", url: "https://tm47.immigration.go.th/" }],
    },
  ],

  DE: [
    {
      id: "de_blocked", stage: "before_departure", kind: "money",
      title: "Blocked account (proof of finances)",
      what: "Most non-EU students prove their finances with a blocked account (Sperrkonto). Check the current required amount with the embassy.",
      issuer: "German embassy / approved providers",
      links: [{ label: "DAAD", url: "https://www.daad.de/en/" }],
    },
    {
      id: "de_visa", stage: "before_departure", kind: "immigration",
      title: "National (D) student visa",
      what: "Apply at the German embassy or consulate with your admission letter, blocked account confirmation and health insurance.",
      issuer: "Federal Foreign Office",
      links: [
        { label: "Visa service (Federal Foreign Office)", url: "https://www.auswaertiges-amt.de/en/visa-service" },
        { label: "Study in Germany", url: "https://www.study-in-germany.de/en/" },
      ],
    },
    {
      id: "de_anmeldung", stage: "on_arrival", kind: "registration",
      title: "Register your address (Anmeldung)",
      what: "Register at the local citizens' office within 14 days of moving in, using the landlord confirmation form.",
      issuer: "Bürgeramt (citizens' office)", when: "Within 14 days",
      links: [{ label: "Make it in Germany", url: "https://www.make-it-in-germany.com/en/" }],
    },
    {
      id: "de_residence", stage: "on_arrival", kind: "immigration", minMonths: 3,
      title: "Residence permit for study",
      what: "Before your entry visa expires, apply for the residence permit at the foreigners' authority (Ausländerbehörde).",
      issuer: "Ausländerbehörde",
      links: [{ label: "Make it in Germany", url: "https://www.make-it-in-germany.com/en/" }],
    },
  ],
};

const GENERIC_IMMIGRATION: PaperStep[] = [
  {
    id: "gen_visa", stage: "before_departure", kind: "immigration",
    title: "Student visa or permit",
    what: "Check the official immigration website or the embassy of your destination in your home country for the student visa that matches your programme length.",
    issuer: "Destination country's embassy / immigration authority",
    links: [],
  },
  {
    id: "gen_register", stage: "on_arrival", kind: "registration",
    title: "Register your stay",
    what: "Many countries require you to register your address or apply for a residence card soon after arrival. Your international office will know the deadline.",
    issuer: "Local immigration / city office",
    links: [],
  },
];

const EARLY = new Set(["uni_nomination", "uni_exchange_application", "uni_offer", "uni_learning_agreement"]);

export interface PaperworkProfile {
  destCountry: string;
  studentType: StudentType;
  stayMonths: number;
}

export function stepsFor(p: PaperworkProfile): PaperStep[] {
  const country = COUNTRY_STEPS[p.destCountry] ?? GENERIC_IMMIGRATION;
  const all = [...country, ...UNIVERSITY_STEPS].filter((s) =>
    (!s.for || s.for.includes(p.studentType))
    && (s.minMonths == null || p.stayMonths > s.minMonths)
    && (s.maxMonths == null || p.stayMonths <= s.maxMonths));
  // Within a stage, application steps come before the forms they unlock.
  const rank = (s: PaperStep) => STAGES.indexOf(s.stage) * 10 + (EARLY.has(s.id) ? 0 : s.id === "uni_accommodation" ? 2 : 1);
  return all.sort((a, b) => rank(a) - rank(b));
}

export function hasCountryGuide(code: string): boolean {
  return code in COUNTRY_STEPS;
}

export const ALL_STEP_IDS = new Set(
  [...Object.values(COUNTRY_STEPS).flat(), ...UNIVERSITY_STEPS, ...GENERIC_IMMIGRATION].map((s) => s.id),
);
