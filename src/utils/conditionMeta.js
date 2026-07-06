const CONDITION_CATEGORIES = {
  allergy: { icon: 'emergency', color: '#172554', label: 'Allergy' },
  disease: { icon: 'medical_services', color: '#172554', label: 'Condition' },
  general: { icon: 'health_and_safety', color: '#172554', label: 'General' },
};

const CATEGORY_KEYWORDS = {
  allergy: ['allergy', 'allergic', 'urticaria', 'food allerg'],
  disease: [
    'glaucoma', 'cataract', 'macular degeneration', 'retinopathy', 'retinitis', 'dry eye', 'uveitis',
    'eczema', 'psoriasis', 'rosacea', 'vitiligo', 'lichen', 'pemphig', 'morphea', 'dermatit', 'hidradenitis', 'alopecia', 'acne', 'scleroderma', 'cutaneous',
    'anemia', 'sickle cell', 'thalassemia', 'hemophilia', 'thrombocytopeni', 'polycythemia', 'myelodysplastic', 'myelofibrosis', 'thrombocythemia', 'von willebrand', 'spherocytosis', 'factor v', 'waldenstrom', 'aplastic',
    'kidney', 'renal', 'nephro', 'glomerulo', 'nephrotic', 'bladder', 'urinary', 'interstitial cystitis', 'incontinence',
    'asthma', 'copd', 'pulmonary', 'lung', 'bronch', 'emphysema', 'cystic fibrosis', 'pneumonitis', 'pleuritis', 'vocal cord', 'nasal poly', 'rhinosinusitis', 'sinusitis', 'sleep apnea', 'alpha-1 antitrypsin',
    'bowel', 'ibs', 'crohn', 'colitis', 'celiac', 'coeliac', 'gastro', 'liver', 'hepat', 'pancrea', 'diverticulit', 'dyspepsia', 'esophag', 'fecal', 'bile', 'peptic', 'fructose', 'lactose', 'short bowel', 'constipation',
    'heart', 'cardiac', 'cardio', 'hypertension', 'blood pressure', 'arrhythmia', 'atrial', 'coronary', 'vein', 'venous', 'thrombosis', 'arterial', 'artery', 'varicose',
    'cancer', 'lymphoma', 'myeloma', 'neuroendocrine tumor', 'carcinoid',
    'parkinson', 'alzheimer', 'epilepsy', 'multiple sclerosis', 'huntington', 'neuropathy', 'migraine', 'dementia', 'tremor', 'palsy', 'ataxia', 'narcolepsy', 'neurofibro', 'trigeminal', 'tinnitus', 'nystagmus', 'tourette', 'tic disorder', 'als ', 'lou gehrig', 'hydrocephalus', 'intracranial', 'restless leg', 'periodic limb', 'spinal cord', 'spina bifida', 'charcot', 'tuberous sclerosis', 'myasthenia', 'cluster headache', 'circadian', 'meniere', 'otosclerosis',
    'depression', 'anxiety', 'bipolar', 'schizophrenia', 'ocd', 'obsessive', 'ptsd', 'adhd', 'panic disorder', 'eating disorder', 'phobia', 'agoraphobia', 'borderline personality', 'dysthymia', 'seasonal affective', 'cyclothymic', 'social anxiety', 'autism',
    'arthritis', 'osteoporosis', 'spondyl', 'fibromyalgia', 'gout', 'back pain', 'sciatica', 'disc disease', 'stenosis', 'muscular dystrophy', 'limb-girdle', 'myositis', 'pelvic floor', 'stiff person', 'ehlers-danlos', 'marfan', 'chronic pain', 'complex regional',
    'lupus', 'sle)', 'sjogren', 'autoimmune', 'sarcoidosis', 'vasculitis', 'behcet', 'immunodeficiency', 'graft-versus', 'raynaud', 'antiphospholipid', 'mixed connective', 'amyloidosis', 'mastocytosis', 'langerhans', 'castleman', 'graves', 'long covid', 'hiv', 'chronic lyme',
    'diabetes', 'diabetic', 'thyroid', 'metabolic', 'cholesterol', 'hyperlipidemia', 'cushing', 'addison', 'acromegaly', 'pcos', 'polycystic ovary', 'prolactinoma', 'hypogonadism', 'phenylketonuria', 'pheochromocytoma', 'hyperparathyroid', 'hypoparathyroid', 'g6pd', 'gaucher', 'fabry', 'hemochromatosis', 'wilson', 'porphyria', 'gallstone',
  ],
};

export function getConditionMeta(name) {
  const lower = name.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return CONDITION_CATEGORIES[cat];
    }
  }
  return CONDITION_CATEGORIES.general;
}
