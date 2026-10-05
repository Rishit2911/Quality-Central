// Shared proctoring configuration helpers.
//
// The proctoring engine in AssessmentTaker is driven entirely by the thresholds
// below. HR configures a single `strictness` slider (lenient / balanced / strict)
// plus boolean feature toggles. The strictness level expands into concrete
// detection thresholds (sustain times, sensitivity, strike limits) so the same
// detection code behaves "harder" or "softer" without HR touching raw numbers.

export const STRICTNESS_LEVELS = {
  none: {
    label: 'None (Disabled)',
    badge: 'No Camera / Mic',
    description: 'Completely unmonitored. Candidates take the test with zero proctoring checks and no webcam or microphone required.',
    disabled: true,
    max_strikes: 999,
    grace_ms: 999999,
    face_missing_sustain_ms: 999999,
    multiple_people_sustain_ms: 999999,
    multiple_people_min_samples: 999,
    gaze_averted_sustain_ms: 999999,
    head_turn_sustain_ms: 999999,
    gaze_bs_horiz_threshold: 1.0,
    gaze_bs_vert_threshold: 1.0,
    gaze_iris_x_threshold: 1.0,
    gaze_iris_y_threshold: 1.0,
    voice_sustain_ms: 999999,
    audio_cooldown_ms: 999999,
    tab_switch_cooldown_ms: 999999,
  },
  lenient: {
    label: 'Lenient',
    description: 'Relaxed monitoring. Only clear, sustained violations are flagged. Good for low-stakes practice.',
    max_strikes: 8,
    grace_ms: 12000,
    face_missing_sustain_ms: 10000,
    multiple_people_sustain_ms: 15000,
    multiple_people_min_samples: 3,
    gaze_averted_sustain_ms: 9000,
    head_turn_sustain_ms: 9000,
    gaze_bs_horiz_threshold: 0.65,
    gaze_bs_vert_threshold: 0.70,
    gaze_iris_x_threshold: 0.26,
    gaze_iris_y_threshold: 0.16,
    voice_sustain_ms: 4500,
    audio_cooldown_ms: 60000,
    tab_switch_cooldown_ms: 20000,
  },
  balanced: {
    label: 'Balanced',
    description: 'Recommended default. Reasonable sensitivity with anti-false-positive guards.',
    max_strikes: 5,
    grace_ms: 8000,
    face_missing_sustain_ms: 7000,
    multiple_people_sustain_ms: 6000,
    multiple_people_min_samples: 3,
    gaze_averted_sustain_ms: 4000,
    head_turn_sustain_ms: 6000,
    gaze_bs_horiz_threshold: 0.55,
    gaze_bs_vert_threshold: 0.60,
    gaze_iris_x_threshold: 0.22,
    gaze_iris_y_threshold: 0.20,
    voice_sustain_ms: 3200,
    audio_cooldown_ms: 45000,
    tab_switch_cooldown_ms: 15000,
  },
  strict: {
    label: 'Strict',
    description: 'High-security exam. Any deviation is flagged quickly and strikes accumulate fast.',
    max_strikes: 3,
    grace_ms: 5000,
    face_missing_sustain_ms: 4000,
    multiple_people_sustain_ms: 6000,
    multiple_people_min_samples: 3,
    gaze_averted_sustain_ms: 3500,
    head_turn_sustain_ms: 3500,
    gaze_bs_horiz_threshold: 0.45,
    gaze_bs_vert_threshold: 0.50,
    gaze_iris_x_threshold: 0.18,
    gaze_iris_y_threshold: 0.24,
    voice_sustain_ms: 2000,
    audio_cooldown_ms: 30000,
    tab_switch_cooldown_ms: 10000,
  },
};

export const PROCTORING_FEATURES = [
  { key: 'full_screen', label: 'Enforce Full Screen', description: 'Candidate must remain in full screen for the duration of the test.' },
  { key: 'tab_switch', label: 'Detect Tab Switching / Window Change', description: 'Issues a strike whenever the candidate leaves the assessment tab.' },
  { key: 'multiple_people', label: 'Detect Multiple People in Camera', description: 'Flags sessions where more than one face is detected in the webcam feed.' },
  { key: 'face_not_visible', label: 'Detect Face Not Visible', description: 'Issues a strike if the candidate\'s face disappears from view for too long.' },
  { key: 'eye_tracking', label: 'Detect Candidate Looking Away (Gaze)', description: 'Uses MediaPipe blendshapes to detect if the candidate looks off-screen.' },
  { key: 'head_turn', label: 'Detect Excessive Head Turning', description: 'Flags excessive head movement suggesting the candidate is reading from off-screen material.' },
  { key: 'audio_detect', label: 'Detect Speaking / Background Audio', description: 'Uses web audio FFT to detect murmuring or outside voices.' },
  { key: 'block_paste', label: 'Block Copy / Paste into Answers', description: 'Prevents candidates from copying or pasting pre-written content into answers.' },
];

// Features where strictness does NOT apply — binary on/off controls.
export const NOT_APPLICABLE_STRICTNESS = new Set(['full_screen', 'tab_switch', 'block_paste']);

export function isProctoringEnabled(config) {
  if (!config) return true;
  if (config.disabled === true || config.strictness === 'none' || config.strictness === 'disabled') {
    return false;
  }
  // Check if any feature is enabled
  return !!(
    config.full_screen ||
    config.tab_switch ||
    config.multiple_people ||
    config.face_not_visible ||
    config.eye_tracking ||
    config.head_turn ||
    config.audio_detect ||
    config.block_paste
  );
}

export function isCameraRequired(config) {
  if (!isProctoringEnabled(config)) return false;
  return !!(config.multiple_people || config.face_not_visible || config.eye_tracking || config.head_turn);
}

export function isMicrophoneRequired(config) {
  if (!isProctoringEnabled(config)) return false;
  return !!config.audio_detect;
}

export function buildProctoringConfig(strictness = 'balanced', toggles = {}, current = null, customThresholds = null) {
  const isNone = strictness === 'none' || strictness === 'disabled' || toggles?.disabled === true;
  if (isNone) {
    return {
      strictness: 'none',
      disabled: true,
      requires_camera: false,
      requires_microphone: false,
      full_screen: false,
      tab_switch: false,
      multiple_people: false,
      face_not_visible: false,
      eye_tracking: false,
      head_turn: false,
      audio_detect: false,
      block_paste: false,
      max_strikes: 999,
      grace_ms: 999999,
      face_missing_sustain_ms: 999999,
      multiple_people_sustain_ms: 999999,
      multiple_people_min_samples: 999,
      gaze_averted_sustain_ms: 999999,
      gaze_bs_horiz_threshold: 1.0,
      gaze_bs_vert_threshold: 1.0,
      gaze_iris_x_threshold: 1.0,
      gaze_iris_y_threshold: 1.0,
      head_turn_sustain_ms: 999999,
      voice_sustain_ms: 999999,
      audio_cooldown_ms: 999999,
      tab_switch_cooldown_ms: 999999,
    };
  }

  const level = STRICTNESS_LEVELS[strictness] ? strictness : 'balanced';
  const rawCustom = customThresholds?.[level] || (customThresholds && typeof customThresholds === 'object' && !customThresholds.lenient ? customThresholds : {}) || {};
  
  const base = {
    ...STRICTNESS_LEVELS[level],
    ...rawCustom,
  };

  // Map threshold aliases seamlessly
  if (rawCustom.gaze_out_sustain_ms !== undefined) base.gaze_averted_sustain_ms = rawCustom.gaze_out_sustain_ms;
  if (rawCustom.multi_face_samples !== undefined) base.multiple_people_min_samples = rawCustom.multi_face_samples;
  if (rawCustom.audio_voice_sustain_ms !== undefined) base.voice_sustain_ms = rawCustom.audio_voice_sustain_ms;

  const features = {};
  PROCTORING_FEATURES.forEach(f => {
    features[f.key] = toggles[f.key] !== undefined
      ? !!toggles[f.key]
      : (current && current[f.key] !== undefined ? current[f.key] : true);
  });
  return {
    strictness: level,
    disabled: false,
    requires_camera: !!(features.multiple_people || features.face_not_visible || features.eye_tracking || features.head_turn),
    requires_microphone: !!features.audio_detect,
    full_screen: features.full_screen,
    tab_switch: features.tab_switch,
    multiple_people: features.multiple_people,
    face_not_visible: features.face_not_visible,
    eye_tracking: features.eye_tracking,
    head_turn: features.head_turn,
    audio_detect: features.audio_detect,
    block_paste: features.block_paste,
    max_strikes: base.max_strikes,
    grace_ms: base.grace_ms,
    face_missing_sustain_ms: base.face_missing_sustain_ms,
    multiple_people_sustain_ms: base.multiple_people_sustain_ms,
    multiple_people_min_samples: base.multiple_people_min_samples,
    gaze_averted_sustain_ms: base.gaze_averted_sustain_ms,
    gaze_bs_horiz_threshold: base.gaze_bs_horiz_threshold,
    gaze_bs_vert_threshold: base.gaze_bs_vert_threshold,
    gaze_iris_x_threshold: base.gaze_iris_x_threshold,
    gaze_iris_y_threshold: base.gaze_iris_y_threshold,
    head_turn_sustain_ms: base.head_turn_sustain_ms,
    voice_sustain_ms: base.voice_sustain_ms,
    audio_cooldown_ms: base.audio_cooldown_ms,
    tab_switch_cooldown_ms: base.tab_switch_cooldown_ms,
  };
}

export function normalizeProctoringConfig(saved) {
  if (!saved) return buildProctoringConfig('balanced', {});
  if (saved.disabled === true || saved.strictness === 'none' || saved.strictness === 'disabled') {
    return buildProctoringConfig('none', {});
  }
  const strictness = saved.strictness && STRICTNESS_LEVELS[saved.strictness] ? saved.strictness : 'balanced';
  return buildProctoringConfig(strictness, saved, saved, saved);
}
