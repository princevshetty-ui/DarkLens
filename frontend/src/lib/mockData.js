export const MOCK_ANALYSIS = {
  status: "complete",
  analysis_id: "da_mock_001",
  platform_detected: "MakeMyTrip",
  page_type: "checkout",
  timestamp: new Date().toISOString(),
  patterns_detected: [
    {
      pattern_id: "dp_001",
      ccpa_category_id: 5,
      ccpa_category_name: "Forced Action",
      ccpa_legal_reference: "CCPA Dark Pattern Guidelines 2023, Category 5",
      severity: "VIOLATION",
      severity_score: 5,
      title: "Pre-selected Travel Insurance",
      description: "Travel insurance checkbox is checked by default, adding ₹299 without active consent.",
      user_impact: "You are being charged ₹299 for insurance you did not actively select.",
      evidence: {
        element_type: "checkbox",
        content: "Travel Secure Insurance — ₹299 (Recommended)",
        visual_prominence: "low",
        position: "below fare summary"
      },
      confidence: "high",
    },
    {
      pattern_id: "dp_002",
      ccpa_category_id: 6,
      ccpa_category_name: "Drip Pricing",
      ccpa_legal_reference: "CCPA Dark Pattern Guidelines 2023, Category 6",
      severity: "VIOLATION",
      severity_score: 4,
      title: "Hidden Convenience Fee",
      description: "A ₹35 convenience fee appears only at checkout, not shown during search.",
      user_impact: "₹35 was added that was not shown during initial browsing.",
      evidence: {
        element_type: "price",
        content: "Convenience Fee: ₹35",
        visual_prominence: "hidden",
        position: "bottom of price breakdown"
      },
      confidence: "high",
    },
    {
      pattern_id: "dp_003",
      ccpa_category_id: 1,
      ccpa_category_name: "False Urgency",
      ccpa_legal_reference: "CCPA Dark Pattern Guidelines 2023, Category 1",
      severity: "CAUTION",
      severity_score: 3,
      title: "Urgency Countdown Timer",
      description: "A 'seats left' warning with countdown creates artificial scarcity pressure.",
      user_impact: "You may rush your decision based on potentially artificial scarcity.",
      evidence: {
        element_type: "timer",
        content: "Only 2 seats left! Book in 04:32",
        visual_prominence: "high",
        position: "top banner"
      },
      confidence: "medium",
    },
  ],
  total_patterns_found: 3,
  categories_violated: [1, 5, 6],
  hidden_costs: [
    { label: "Travel Insurance", amount: "₹299", was_disclosed_upfront: false, disclosure_quality: "hidden" },
    { label: "Convenience Fee", amount: "₹35", was_disclosed_upfront: false, disclosure_quality: "only_at_checkout" },
  ],
  estimated_overcharge: "₹334",
  manipulation_score: 72,
  grade: "D",
  grade_label: "Severe — Aggressive dark patterns detected",
  grade_color: "#f97316",
  summary: "This checkout contains 3 dark patterns. Pre-selected insurance and hidden fees add ₹334 without active consent.",
};

export const MOCK_SCANNING_STEPS = [
  { id: 1, label: "Capturing page elements", duration: 800 },
  { id: 2, label: "Analyzing visual hierarchy", duration: 1200 },
  { id: 3, label: "Detecting manipulation patterns", duration: 1500 },
  { id: 4, label: "Classifying against CCPA taxonomy", duration: 1000 },
  { id: 5, label: "Computing manipulation score", duration: 600 },
  { id: 6, label: "Generating forensic report", duration: 400 },
];