import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import {
  Camera, Shield, AlertTriangle, CheckCircle, Clock, Play,
  ChevronRight, ChevronLeft, Send, Loader2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import HorizontalLoader from '../../../core/components/HorizontalLoader';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  isValidEmail,
  isValidPhone,
  isValidURL,
  isPositiveNumber
} from '../../../core/utils/validators';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import { 
  normalizeProctoringConfig, 
  isProctoringEnabled, 
  isCameraRequired, 
  isMicrophoneRequired 
} from '../proctoringConfig';

export default function AssessmentTaker({ assessmentId: propAsmId }) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const asmId = propAsmId || params.get('asm_id');

  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);

  // States
  const [step, setStep] = useState('setup'); // setup, taking, finished
  const [stream, setStream] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [browserSupported, setBrowserSupported] = useState(true);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Test state
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [completedSectionIds, setCompletedSectionIds] = useState([]);
  const [currentQIndexInSection, setCurrentQIndexInSection] = useState(0);
  const [answers, setAnswers] = useState({});
  const [sectionTimeLeft, setSectionTimeLeft] = useState(0);
  const [showNextSectionModal, setShowNextSectionModal] = useState(false);
  const [proctoringEvents, setProctoringEvents] = useState([]);
  const pgEvents = useRef([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const startTimeRef = useRef(null);
  const sessionStartedAtRef = useRef(null);
  const [errors, setErrors] = useState({});
  const [strikeCount, setStrikeCount] = useState(0);

  // Resume state
  const [sessionAlreadyStarted, setSessionAlreadyStarted] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  // Proctoring config — derived from assignment's saved config (strictness + toggles)
  const [savedProctoringConfig, setSavedProctoringConfig] = useState(null);
  const proctoringConfig = useMemo(() => normalizeProctoringConfig(savedProctoringConfig), [savedProctoringConfig]);
  const proctoringActive = useMemo(() => isProctoringEnabled(proctoringConfig), [proctoringConfig]);
  const cameraRequired = useMemo(() => isCameraRequired(proctoringConfig), [proctoringConfig]);
  const micRequired = useMemo(() => isMicrophoneRequired(proctoringConfig), [proctoringConfig]);

  // Proctoring Refs
  const strikes = useRef(0);
  const canvasRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const violationCooldownsRef = useRef({});
  const lastStrikeTime = useRef(0);
  const seenFaceOnceRef = useRef(false);
  const audioCalibrationRef = useRef({ samples: [], baseline: null });
  const audioStateRef = useRef({ quietSamples: 0, lockedUntil: 0 });
  const audioViolationTimer = useRef(null);
  const cameraTrackViolationTimer = useRef(null);
  const cameraObstructedTimerRef = useRef(null);
  const lastSpeechStrikeRef = useRef({ transcript: '', time: 0 });

  // MediaPipe FaceLandmarker refs (replaces skin-pixel heuristics + native FaceDetector)
  const faceLandmarkerRef = useRef(null);
  const faceLandmarkerReadyRef = useRef(false);
  const gazeStrikeTimerRef = useRef(null);
  const headTurnStrikeTimerRef = useRef(null);
  const faceMissingTimerRef = useRef(null);
  const multiFaceStartRef = useRef(0);
  const multiFaceSamplesRef = useRef(0);

  const handleCheatAttemptRef = useRef(null);
  const submitRef = useRef(null);

  useEffect(() => {
    if (!asmId) return;
    setLoading(true);
    fetch(`/api/verify/builder/assessments/${asmId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          const data = d.data;
          setAssessment(data);

          // Restore saved proctoring config (strictness + feature toggles)
          if (data.proctoring_config) setSavedProctoringConfig(data.proctoring_config);

          // Restore strikes from DB (survives page reloads)
          if (data.strike_count !== undefined) {
            strikes.current = data.strike_count;
            setStrikeCount(data.strike_count);
          }

          // Server-authoritative timer
          if (data.session_already_started) {
            setSessionAlreadyStarted(true);
            if (data.time_remaining_seconds !== null && data.time_remaining_seconds !== undefined) {
              setSectionTimeLeft(data.time_remaining_seconds);
            }
          }
        } else {
          toast.error('Failed to load assessment');
        }
      })
      .finally(() => setLoading(false));

    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    };
  }, [asmId]);

  
  const [webGlSupported, setWebGlSupported] = useState(null); // null = checking

  useEffect(() => {
    // Browser check
    const ua = navigator.userAgent;
    const isChrome = /Chrome/.test(ua) && /Google Inc/.test(navigator.vendor);
    const isEdge = /Edg/.test(ua);
    const isBrave = navigator.brave !== undefined;
    if ((!isChrome && !isEdge) || isBrave) {
      setBrowserSupported(false);
    }

    // WebGL capability check — determines whether CV proctoring features work.
    // CV features (face detection, gaze, head turn, multiple people) require WebGL.
    // If unavailable (hardware accel disabled, VM, old GPU), those features are
    // silently skipped and the candidate is shown which checks ARE active.
    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
      setWebGlSupported(!!gl);
      if (gl) {
        // Release the context so we don't waste it
        const ext = gl.getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();
      }
    } catch {
      setWebGlSupported(false);
    }
  }, []);

  const resolvedSections = useMemo(() => {
    if (!assessment) return [];
    const rawSections = Array.isArray(assessment.sections) ? assessment.sections : [];
    if (rawSections.length === 0) {
      return [{
        id: 'default_section',
        title: 'All Questions',
        instructions: assessment.description || '',
        time_limit_minutes: assessment.time_limit_minutes || 60,
        questions: assessment.questions || []
      }];
    }

    return rawSections.map((sec, idx) => {
      const secQuestions = (assessment.questions || []).filter(q => {
        if (q.section_id) return q.section_id === sec.id;
        return idx === 0;
      });
      return {
        ...sec,
        time_limit_minutes: sec.time_limit_minutes || Math.floor((assessment.time_limit_minutes || 60) / rawSections.length) || 30,
        questions: secQuestions
      };
    });
  }, [assessment]);

  const activeSection = resolvedSections[activeSectionIdx] || resolvedSections[0];
  const activeSectionQuestions = activeSection?.questions || [];
  const currentQuestion = activeSectionQuestions[currentQIndexInSection] || activeSectionQuestions[0];

  // Initialize/reset section timer when section changes or test starts
  useEffect(() => {
    if (!hasStarted || !activeSection) return;
    const mins = activeSection.time_limit_minutes || assessment?.time_limit_minutes || 30;
    setSectionTimeLeft(mins * 60);
  }, [activeSectionIdx, hasStarted]);

  // Section Timer Countdown
  useEffect(() => {
    if (!hasStarted || sectionTimeLeft === null || sectionTimeLeft === undefined) return;
    if (sectionTimeLeft <= 0) {
      const isLastSection = activeSectionIdx >= resolvedSections.length - 1;
      if (isLastSection) {
        toast.error('Time limit for final section has expired. Submitting assessment...', { duration: 6000 });
        submitRef.current?.(true);
      } else {
        toast.error(`Time limit for ${activeSection?.title || 'current section'} expired! Advancing to next section.`, { duration: 6000 });
        setCompletedSectionIds(prev => [...new Set([...prev, activeSection?.id])]);
        setActiveSectionIdx(prev => prev + 1);
        setCurrentQIndexInSection(0);
      }
      return;
    }
    const t = setTimeout(() => setSectionTimeLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [sectionTimeLeft, hasStarted, activeSectionIdx, resolvedSections.length, activeSection]);

  const handleProceedToNextSection = () => {
    const isLastSection = activeSectionIdx >= resolvedSections.length - 1;
    if (isLastSection) {
      handleSubmit();
    } else {
      setShowNextSectionModal(true);
    }
  };

  const confirmProceedToNextSection = () => {
    setShowNextSectionModal(false);
    if (!activeSection) return;
    setCompletedSectionIds(prev => [...new Set([...prev, activeSection.id])]);
    const nextIdx = activeSectionIdx + 1;
    setActiveSectionIdx(nextIdx);
    setCurrentQIndexInSection(0);
    const nextSec = resolvedSections[nextIdx];
    toast.success(`Section ${activeSection.title} completed! Started ${nextSec?.title || 'next section'}.`);
  };

  const captureScreenshot = useCallback((label = 'Snapshot') => {
    if (videoRef.current && canvasRef.current) {
      const vid = videoRef.current;
      const can = canvasRef.current;
      if (vid.readyState >= 2) {
        can.width = vid.videoWidth || 640;
        can.height = vid.videoHeight || 480;
        const ctx = can.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(vid, 0, 0, can.width, can.height);
        const dataUrl = can.toDataURL('image/jpeg', 0.5);
        const evt = { type: 'screenshot', details: dataUrl, timestamp: new Date().toISOString() };
        pgEvents.current.push(evt);
        setProctoringEvents(prev => [...prev, evt]);
      }
    }
  }, []);

  const handleProctoringViolation = useCallback(async (actionName, eventType = 'proctoring_violation', cooldownMs = 15000) => {
    if (!hasStarted || submittingRef.current) return false;

    const GRACE_MS = proctoringConfig.grace_ms || 8000;
    const startedAt = sessionStartedAtRef.current || 0;
    if (startedAt && (Date.now() - startedAt) < GRACE_MS) return false;

    const now = Date.now();
    const lastForThisViolation = violationCooldownsRef.current[actionName] || 0;
    if (now - lastForThisViolation < cooldownMs) return false;
    if (now - lastStrikeTime.current < 1000) return false;

    violationCooldownsRef.current[actionName] = now;
    lastStrikeTime.current = now;

    strikes.current++;
    setStrikeCount(strikes.current);
    captureScreenshot(`Cheat: ${actionName}`);

    const evt = { type: eventType, timestamp: new Date().toISOString(), details: actionName };
    pgEvents.current.push(evt);
    setProctoringEvents(prev => [...prev, evt]);

    // Capture audio snippet for audio-related violations
    if (streamRef.current && (actionName.includes('Audio') || actionName.includes('Speaking') || actionName.includes('Voice') || actionName.includes('Murmur'))) {
      try {
        const recorder = new MediaRecorder(streamRef.current);
        const chunks = [];
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = () => {
            pgEvents.current.push({ type: 'audio_snippet', details: reader.result, timestamp: new Date().toISOString() });
          };
        };
        recorder.start();
        setTimeout(() => recorder.stop(), 3000);
      } catch (e) { console.error('Snippet capture failed:', e); }
    }

    const MAX_STRIKES = proctoringConfig.max_strikes || 5;
    const isTerminal = strikes.current >= MAX_STRIKES;

    try {
      const r = await fetch(`/api/verify/assignments/${asmId}/record-strike`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          violation_name: actionName,
          flag_type: eventType,
          is_terminal: isTerminal,
        }),
      });
      const d = await r.json();
      if (d.data?.terminated_by_proctor || isTerminal) {
        toast.error('Assessment terminated due to excessive proctoring violations.', { duration: 5000 });
        submitRef.current?.(true);
      } else {
        toast.error(`Warning: ${actionName}! (Strike ${strikes.current}/${MAX_STRIKES})`, { icon: '⚠️', duration: 4000 });
      }
    } catch (e) { console.error('Strike record failed', e); }
    return true;
  }, [hasStarted, asmId, captureScreenshot, proctoringConfig]);

  useEffect(() => { submitRef.current = handleSubmit; }, [answers, proctoringEvents]);
  useEffect(() => { handleCheatAttemptRef.current = handleProctoringViolation; }, [handleProctoringViolation]);

  // Periodic screenshots (only if camera is required)
  useEffect(() => {
    if (!hasStarted || !cameraRequired) return;
    const t0 = setTimeout(() => captureScreenshot('Initial Snapshot'), 5000);
    const t1 = setInterval(() => captureScreenshot('Periodic Screenshot'), 60000);
    return () => { clearTimeout(t0); clearInterval(t1); };
  }, [hasStarted, cameraRequired, captureScreenshot]);

  // Tab & Fullscreen monitors — respect proctoringConfig feature toggles
  useEffect(() => {
    if (!hasStarted || !proctoringActive) return;
    const handleVisibility = () => {
      if (document.hidden && proctoringConfig.tab_switch !== false) {
        handleProctoringViolation('Tab Switching / Window Change', 'tab_switch',
          proctoringConfig.tab_switch_cooldown_ms || 15000);
      }
    };
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && proctoringConfig.full_screen !== false) {
        handleProctoringViolation('Exited Full Screen', 'proctoring_violation', 10000);
      }
    };

    const handleBlur = () => {
      if (proctoringConfig.tab_switch !== false) {
        handleProctoringViolation('Window Lost Focus / Clicked Away', 'tab_switch', proctoringConfig.tab_switch_cooldown_ms || 15000);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [hasStarted, proctoringActive, proctoringConfig, handleProctoringViolation]);

  // Copy / Paste / Context Menu blocking when block_paste is enabled
  useEffect(() => {
    if (!hasStarted || !proctoringActive || proctoringConfig.block_paste === false) return;

    const handleCopyCutPaste = (e) => {
      e.preventDefault();
      toast.error('Copy/Paste is disabled during this proctored assessment.');
      handleCheatAttemptRef.current?.(`Clipboard Access (${e.type}) Attempted`, 'proctoring_violation', 5000);
    };

    const handleContextMenu = (e) => {
      e.preventDefault();
    };

    document.addEventListener('copy', handleCopyCutPaste);
    document.addEventListener('cut', handleCopyCutPaste);
    document.addEventListener('paste', handleCopyCutPaste);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('copy', handleCopyCutPaste);
      document.removeEventListener('cut', handleCopyCutPaste);
      document.removeEventListener('paste', handleCopyCutPaste);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [hasStarted, proctoringActive, proctoringConfig.block_paste]);

  // ── MediaPipe FaceLandmarker + Audio proctoring loop ──────────────────────────
  useEffect(() => {
    if (!hasStarted || !proctoringActive || (!cameraRequired && !micRequired)) return;

    // ── LAYER 1: SpeechRecognition ─────────────────────────────────────────────
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition && proctoringConfig.audio_detect !== false) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = '';
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        const last = event.results[event.results.length - 1];
        const transcript = (last[0]?.transcript || '').trim();
        if (!transcript) return;
        const highConfidenceInterim = !last.isFinal && (last[0]?.confidence || 0) >= 0.85 && transcript.length >= 3;
        if (last.isFinal || highConfidenceInterim) {
          const last_ = lastSpeechStrikeRef.current;
          const now_ = Date.now();
          if (transcript === last_.transcript && now_ - last_.time < 12000) return;
          lastSpeechStrikeRef.current = { transcript, time: now_ };
          handleCheatAttemptRef.current?.('Speaking Detected During Assessment', 'audio_detected', 8000);
        }
      };
      recognition.onerror = (e) => { if (e.error !== 'no-speech' && e.error !== 'aborted') console.warn('SR:', e.error); };
      recognition.onend = () => { try { recognition.start(); } catch (_) {} };
      try { recognition.start(); } catch (_) {}
      speechRecognitionRef.current = recognition;
    }

    // ── LAYER 2: Web Audio FFT (murmur detection, every 500ms) ────────────────
    const VOICE_SUSTAIN_MS = proctoringConfig.voice_sustain_ms || proctoringConfig.audio_voice_sustain_ms || 3200;
    const audioInterval = setInterval(() => {
      if (proctoringConfig.audio_detect === false || !analyserRef.current || !audioCtxRef.current) return;
      const fftSize = analyserRef.current.fftSize;
      const sampleRate = audioCtxRef.current?.sampleRate || 44100;
      const binHz = sampleRate / fftSize;
      const voiceLow  = Math.floor(300  / binHz);
      const voiceHigh = Math.floor(3400 / binHz);
      const buf = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(buf);
      const voiceBand  = buf.slice(voiceLow, voiceHigh + 1);
      const voiceAvg   = voiceBand.reduce((a, b) => a + b, 0) / voiceBand.length;
      const activeBins = voiceBand.filter(v => v > 20).length;
      const voiceRatio = activeBins / voiceBand.length;
      const timeBuf    = new Uint8Array(analyserRef.current.fftSize);
      analyserRef.current.getByteTimeDomainData(timeBuf);
      let rmsSum = 0;
      for (const s of timeBuf) { const c = (s - 128) / 128; rmsSum += c * c; }
      const rms = Math.sqrt(rmsSum / timeBuf.length);

      const cal = audioCalibrationRef.current;
      if (cal.samples.length < 8) {
        cal.samples.push(voiceAvg);
        cal.baseline = cal.samples.reduce((a, b) => a + b, 0) / cal.samples.length;
        return;
      }
      const baseline = cal.baseline || 0;
      const energeticVoice = voiceAvg > Math.max(baseline + 18, 24) && voiceRatio > 0.25;
      const loudMicActivity = voiceAvg > Math.max(baseline + 14, 20) && rms > 0.07;
      const isVoiceLike = energeticVoice || loudMicActivity;

      if (isVoiceLike) {
        if (!audioViolationTimer.current) audioViolationTimer.current = Date.now();
        if (Date.now() - audioViolationTimer.current > VOICE_SUSTAIN_MS) {
          const fired = handleCheatAttemptRef.current?.('Voice / Audio Detected Near Microphone', 'audio_detected',
            proctoringConfig.audio_cooldown_ms || 45000);
          if (fired) audioViolationTimer.current = null;
        }
      } else {
        audioViolationTimer.current = null;
        cal.baseline = baseline * 0.97 + voiceAvg * 0.03;
      }
    }, 500);

    // ── LAYER 3: Camera track health check (every 2s) ─────────────────────────
    const hasCamFeatures = proctoringConfig.multiple_people !== false ||
                           proctoringConfig.face_not_visible !== false ||
                           proctoringConfig.eye_tracking !== false ||
                           proctoringConfig.head_turn !== false;

    const trackHealthInterval = setInterval(() => {
      if (!hasCamFeatures) return;
      const videoTrack = streamRef.current?.getVideoTracks?.()[0];
      const trackDead = !videoTrack || videoTrack.readyState !== 'live' || videoTrack.muted || !videoTrack.enabled;
      if (trackDead) {
        if (!cameraTrackViolationTimer.current) cameraTrackViolationTimer.current = Date.now();
        if (Date.now() - cameraTrackViolationTimer.current > 2000) {
          handleCheatAttemptRef.current?.('Camera Disabled or Unavailable', 'camera_disabled', 15000);
          cameraTrackViolationTimer.current = null;
        }
      } else {
        cameraTrackViolationTimer.current = null;
      }
    }, 2000);

    // ── LAYER 4: MediaPipe FaceLandmarker CV detection (every 250ms) ──────────
    let rafId = null;
    let lastCvTs = 0;
    const CV_INTERVAL_MS = 250;

    const FACE_SUSTAIN   = proctoringConfig.face_missing_sustain_ms || 7000;
    const GAZE_SUSTAIN   = proctoringConfig.gaze_averted_sustain_ms || 4000;
    const HEAD_SUSTAIN   = proctoringConfig.head_turn_sustain_ms || 6000;
    const MULTI_SUSTAIN  = proctoringConfig.multiple_people_sustain_ms || 6000;
    const MULTI_SAMPLES  = proctoringConfig.multiple_people_min_samples || 3;

    const runCV = async (ts) => {
      rafId = requestAnimationFrame(runCV);
      if (ts - lastCvTs < CV_INTERVAL_MS) return;
      lastCvTs = ts;

      const vid = videoRef.current;
      if (!vid || vid.readyState < 2 || vid.videoWidth === 0) return;

      // ── Camera obstruction check (brightness) ─────────────────────────────
      // avgBright of a normal lit room is ~80-150. Dark room / covered = <20.
      const can = canvasRef.current;
      if (can) {
        const ctx = can.getContext('2d', { willReadFrequently: true });
        can.width = 80; can.height = 60;
        ctx.drawImage(vid, 0, 0, 80, 60);
        const px = ctx.getImageData(0, 0, 80, 60).data;
        let bright = 0;
        for (let i = 0; i < px.length; i += 4) bright += (px[i] + px[i+1] + px[i+2]) / 3;
        const avgBright = bright / (80 * 60);
        // Fire only when very dark (hand/finger covering lens)
        if (avgBright < 20) {
          if (!cameraObstructedTimerRef.current) cameraObstructedTimerRef.current = Date.now();
          if (Date.now() - cameraObstructedTimerRef.current > 2000) {
            handleCheatAttemptRef.current?.('Camera Obstructed / Covered', 'camera_obstructed', 15000);
            cameraObstructedTimerRef.current = Date.now();
          }
        } else {
          cameraObstructedTimerRef.current = null;
        }
      }

      if (!faceLandmarkerReadyRef.current || !faceLandmarkerRef.current) return;

      // ── MediaPipe FaceLandmarker detectForVideo ────────────────────────────
      let result;
      try {
        result = faceLandmarkerRef.current.detectForVideo
          ? faceLandmarkerRef.current.detectForVideo(vid, Math.floor(ts))  // MediaPipe
          : await faceLandmarkerRef.current.detect(vid);                   // FaceDetector fallback
      } catch (e) {
        console.error('[Proctoring] CV detect error:', e);
        return;
      }

      // Normalise result shape: MediaPipe uses faceLandmarks[], FaceDetector uses array directly
      const isMp = !!result?.faceLandmarks;
      const faces         = isMp ? (result.faceLandmarks || [])              : (result || []);
      const blendshapes   = isMp ? (result.faceBlendshapes || [])            : [];
      const matrices      = isMp ? (result.facialTransformationMatrixes || []) : [];

      // ── Face present / missing ─────────────────────────────────────────────
      if (faces.length >= 1) {
        seenFaceOnceRef.current = true;
        if (faceMissingTimerRef.current) { clearTimeout(faceMissingTimerRef.current); faceMissingTimerRef.current = null; }
      } else if (seenFaceOnceRef.current && proctoringConfig.face_not_visible) {
        if (!faceMissingTimerRef.current) {
          faceMissingTimerRef.current = setTimeout(() => {
            faceMissingTimerRef.current = null;
            handleCheatAttemptRef.current?.('Face Not Visible — Please Stay in Frame', 'person_not_visible', 12000);
            captureScreenshot('Face Not Visible');
          }, FACE_SUSTAIN);
        }
      }

      // ── Multiple people ────────────────────────────────────────────────────
      if (proctoringConfig.multiple_people) {
        if (faces.length >= 2) {
          multiFaceSamplesRef.current++;
          if (multiFaceStartRef.current === 0) multiFaceStartRef.current = Date.now();
          const elapsed = Date.now() - multiFaceStartRef.current;
          if (elapsed >= MULTI_SUSTAIN && multiFaceSamplesRef.current >= MULTI_SAMPLES) {
            handleCheatAttemptRef.current?.(`Multiple People Detected in Camera (${faces.length} faces)`, 'proctoring_violation', 45000);
            multiFaceStartRef.current = 0;
            multiFaceSamplesRef.current = 0;
          }
        } else {
          multiFaceStartRef.current = 0;
          multiFaceSamplesRef.current = 0;
        }
      }

      if (faces.length === 0) {
        if (gazeStrikeTimerRef.current)    { clearTimeout(gazeStrikeTimerRef.current); gazeStrikeTimerRef.current = null; }
        if (headTurnStrikeTimerRef.current){ clearTimeout(headTurnStrikeTimerRef.current); headTurnStrikeTimerRef.current = null; }
        return;
      }

      // ── Gaze & Head turn — MediaPipe blendshapes + transformation matrix ──
      let gazeAverted = false;
      let headTurnDetected = false;

      if (isMp && blendshapes.length > 0) {
        // MediaPipe: precise blendshape-based gaze + 3D matrix head pose
        const bs = blendshapes[0]?.categories || [];
        const get = (name) => bs.find(c => c.categoryName === name)?.score ?? 0;
        const GAZE_H = proctoringConfig.gaze_bs_horiz_threshold || 0.55;
        const GAZE_V = proctoringConfig.gaze_bs_vert_threshold || 0.60;
        gazeAverted = proctoringConfig.eye_tracking !== false && (
          get('eyeLookOutLeft') > GAZE_H || get('eyeLookInLeft') > GAZE_H ||
          get('eyeLookOutRight') > GAZE_H || get('eyeLookInRight') > GAZE_H ||
          get('eyeLookUpRight') > GAZE_V  || get('eyeLookDownRight') > GAZE_V
        );
        if (proctoringConfig.head_turn !== false && matrices.length > 0) {
          const m = matrices[0].data;
          if (m && m.length >= 16) {
            const yawDeg = Math.abs(Math.asin(Math.max(-1, Math.min(1, -m[2]))) * 180 / Math.PI);
            headTurnDetected = yawDeg > 20;
          }
        }
      } else if (!isMp) {
        // FaceDetector fallback: approximate from landmark geometry
        const lms = faces[0].landmarks || [];
        const box = faces[0].boundingBox;
        if (lms.length >= 2 && box) {
          const rightEye = lms[0], leftEye = lms[1];
          const eyeMidX = (rightEye.x + leftEye.x) / 2;
          const bboxCenterX = box.x + box.width / 2;
          headTurnDetected = proctoringConfig.head_turn !== false &&
            Math.abs(eyeMidX - bboxCenterX) / (box.width || 1) > 0.18;
          const eyeSpanX = Math.abs(leftEye.x - rightEye.x);
          const eyeOffsetNorm = Math.abs(eyeMidX - bboxCenterX) / (box.width || 1);
          const IRIS_X = proctoringConfig.gaze_iris_x_threshold || 0.22;
          const IRIS_Y = proctoringConfig.gaze_iris_y_threshold || 0.20;
          gazeAverted = proctoringConfig.eye_tracking !== false &&
            (eyeOffsetNorm > IRIS_X || eyeSpanX / (box.width || 1) < IRIS_Y);
        }
      }

      if (gazeAverted) {
        if (!gazeStrikeTimerRef.current) {
          gazeStrikeTimerRef.current = setTimeout(() => {
            gazeStrikeTimerRef.current = null;
            handleCheatAttemptRef.current?.('Looking Away from Screen', 'gaze_averted', 8000);
          }, GAZE_SUSTAIN);
        }
      } else {
        if (gazeStrikeTimerRef.current) { clearTimeout(gazeStrikeTimerRef.current); gazeStrikeTimerRef.current = null; }
      }

      if (headTurnDetected) {
        if (!headTurnStrikeTimerRef.current) {
          headTurnStrikeTimerRef.current = setTimeout(() => {
            headTurnStrikeTimerRef.current = null;
            handleCheatAttemptRef.current?.('Head Turned Away from Screen', 'head_turn', 10000);
          }, HEAD_SUSTAIN);
        }
      } else {
        if (headTurnStrikeTimerRef.current) { clearTimeout(headTurnStrikeTimerRef.current); headTurnStrikeTimerRef.current = null; }
      }
    };

    // ── Face detector init: MediaPipe primary, FaceDetector fallback ──────────
    // MediaPipe provides blendshape-based gaze + 3D matrix head-pose (most accurate).
    // FaceDetector (browser built-in) used as fallback if MediaPipe init fails
    // (e.g. model download failure).
    (async () => {
      if (!faceLandmarkerReadyRef.current) {
        try {
          const vision = await FilesetResolver.forVisionTasks('/mediapipe-wasm');
          // Provide a DOM canvas so emscripten can bind its WebGL context to it.
          // Without this, emscripten tries to create its own OffscreenCanvas and fails.
          const mpCanvas = document.createElement('canvas');
          mpCanvas.width = 1; mpCanvas.height = 1;
          mpCanvas.style.position = 'fixed';
          mpCanvas.style.top = '-9999px';
          mpCanvas.style.left = '-9999px';
          document.body.appendChild(mpCanvas);

          faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
              delegate: 'GPU',
            },
            canvas: mpCanvas,
            runningMode: 'VIDEO',
            numFaces: 3,
            outputFaceBlendshapes: true,
            outputFacialTransformationMatrixes: true,
          });
          faceLandmarkerReadyRef.current = true;
          console.log('[Proctoring] MediaPipe FaceLandmarker ready ✓ (blendshapes + head-pose active)');
        } catch (e) {
          console.warn('[Proctoring] MediaPipe failed, trying native FaceDetector fallback:', e.message);
          // Fallback: browser built-in FaceDetector (no WASM, no extra GL context)
          if ('FaceDetector' in window) {
            try {
              faceLandmarkerRef.current = new window.FaceDetector({ maxDetectedFaces: 4, fastMode: false });
              faceLandmarkerReadyRef.current = true;
              console.log('[Proctoring] FaceDetector fallback ready ✓ (gaze/head-turn via geometry)');
            } catch (e2) {
              console.warn('[Proctoring] FaceDetector fallback also failed:', e2.message);
            }
          }
        }
      }
      // seed seenFaceOnceRef after 10s regardless
      setTimeout(() => { if (!seenFaceOnceRef.current) seenFaceOnceRef.current = true; }, 10000);
      rafId = requestAnimationFrame(runCV);
    })();



    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      clearInterval(audioInterval);
      clearInterval(trackHealthInterval);
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.onend = null;
        try { speechRecognitionRef.current.abort(); } catch (_) {}
        speechRecognitionRef.current = null;
      }
      if (gazeStrikeTimerRef.current)    { clearTimeout(gazeStrikeTimerRef.current); gazeStrikeTimerRef.current = null; }
      if (headTurnStrikeTimerRef.current) { clearTimeout(headTurnStrikeTimerRef.current); headTurnStrikeTimerRef.current = null; }
      if (faceMissingTimerRef.current)   { clearTimeout(faceMissingTimerRef.current); faceMissingTimerRef.current = null; }
      audioViolationTimer.current = null;
      cameraTrackViolationTimer.current = null;
      cameraObstructedTimerRef.current = null;
    };
  }, [hasStarted, proctoringConfig]);


  const requestCamera = async () => {
    try {
      setCameraError('');
      const str = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(str);
      streamRef.current = str;
      if (videoRef.current) {
        videoRef.current.srcObject = str;
      }
    } catch (e) {
      setCameraError('Camera and Microphone access denied or unavailable. This assessment requires both to proceed.');
    }
  };

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [step, stream]);

  const startAssessment = async () => {
    if (cameraRequired || micRequired) {
      if (!stream) {
        toast.error('Camera & Mic access required to start this proctored assessment');
        return;
      }

      // Initialize Web Audio Context requiring user gesture if microphone is required
      if (micRequired && stream && !audioCtxRef.current) {
        try {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          const ctx = new AudioContext();
          await ctx.resume();
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 1024;
          source.connect(analyser);
          audioCtxRef.current = ctx;
          analyserRef.current = analyser;
        } catch (e) {
          console.warn('Audio Context failed to start', e);
        }
      }
    }

    try {
      const r = await fetch(`/api/verify/assignments/${asmId}/start-session`, {
        method: 'POST',
        credentials: 'include',
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.success === false) {
        toast.error(d.detail || d.message || 'Failed to start session');
        return;
      }
      if (d.success && d.data) {
        // Restore server-side state (strikes, time) on every start/resume
        if (d.data.strike_count !== undefined) {
          strikes.current = d.data.strike_count;
          setStrikeCount(d.data.strike_count);
        }
        if (d.data.time_remaining_seconds !== null && d.data.time_remaining_seconds !== undefined) {
          setSectionTimeLeft(d.data.time_remaining_seconds);
        }
        if (d.data.proctoring_config) setSavedProctoringConfig(d.data.proctoring_config);
        if (d.data.terminated_by_proctor) {
          toast.error('This assessment was terminated due to proctoring violations.');
          return;
        }
      }

      // Fullscreen (only if proctoring active and configured)
      if (proctoringActive && proctoringConfig.full_screen !== false) {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(e => console.log('Fullscreen rejected', e));
        }
      }

      sessionStartedAtRef.current = Date.now();
      setStep('taking');
      setHasStarted(true);
      startTimeRef.current = Date.now();
    } catch (e) {
      toast.error('Failed to start session');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  // ── Validation for submission ──
  const validateAnswers = () => {
    const newErrors = {};
    if (!assessment || !assessment.questions) return true;
    assessment.questions.forEach((q, index) => {
      const answer = answers[q.id];
      if (answer && (typeof answer === 'string' && !answer.trim())) {
        newErrors[q.id] = `Question ${index + 1} requires an answer`;
      }
      if (q.question_type === 'file_upload') {
        if (answer instanceof File) {
          const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
          const maxSize = 10 * 1024 * 1024;
          if (!allowedTypes.includes(answer.type)) {
            newErrors[q.id] = `File type not allowed for Question ${index + 1}. Please upload PDF, JPEG, PNG, WebP, DOC, or DOCX.`;
          }
          if (answer.size > maxSize) {
            newErrors[q.id] = `File size exceeds 10MB limit for Question ${index + 1}`;
          }
        }
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (autoSubmit = false) => {
    if (!autoSubmit && !window.confirm('Are you sure you want to submit?')) return;
    
    // ── Run validation before submit ──
    if (!autoSubmit && !validateAnswers()) {
      const firstError = Object.keys(errors)[0];
      if (firstError) {
        toast.error(errors[firstError]);
        const qIdxInActive = activeSectionQuestions.findIndex(q => q.id === firstError);
        if (qIdxInActive !== -1) {
          setCurrentQIndexInSection(qIdxInActive);
        }
      }
      return;
    }
    
    setIsSubmitting(true);
    submittingRef.current = true;
    stopCamera();

    const timeTaken = startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0;
    const maxStrikesAllowed = proctoringConfig.max_strikes || 5;
    const isMalpractice = proctoringActive && (strikes.current >= maxStrikesAllowed || (autoSubmit === true && strikes.current > 0));

    try {
      const r = await fetch('/api/verify/submissions/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessment_id: parseInt(asmId),
          answers,
          time_taken_seconds: timeTaken,
          proctoring_events: pgEvents.current,
          is_malpractice: isMalpractice
        })
      });
      const d = await r.json();
      if (r.ok && d.success) {
        toast.success('Assessment submitted successfully!');
        setStep('finished');
        if (assessment.show_result_immediately) {
          navigate(`/verify?tab=result&result_id=${d.data.result_id}`);
        } else {
          navigate('/verify?tab=candidate');
        }
      } else {
        toast.error(d.detail || 'Submission failed');
      }
    } catch (e) {
      toast.error('Failed to submit. Please contact support.');
    } finally {
      setIsSubmitting(false);
      submittingRef.current = false;
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(e => console.log(e));
      }
    }
  };
  
  // Connect the ref
  useEffect(() => { submitRef.current = handleSubmit; }, [handleSubmit]);

  // Helper to render error message
  const renderError = (questionId) => {
    if (errors[questionId]) {
      return <p className="text-red-500 text-xs font-medium mt-2">{errors[questionId]}</p>;
    }
    return null;
  };

  if (loading) return <HorizontalLoader label="Loading assessment..." />;
  if (!assessment) return <div className="p-10 text-center text-gray-400">Assessment not found</div>;

  if (step === 'setup') {
    return (
      <div className="max-w-2xl mx-auto flex flex-col gap-6 pt-10">
        <div className="text-center mb-4">
          <Shield size={40} className="text-purple-600 mx-auto mb-4 opacity-80" />
          <h1 className="text-3xl font-bold text-gray-800">{assessment.title}</h1>
          <p className="text-gray-500 mt-2">{assessment.description}</p>
        </div>
        
        {browserSupported ? (
        <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-purple-600">Assessment Setup</h2>
            {!cameraRequired && (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                Unmonitored / No Camera
              </span>
            )}
          </div>
          
          {cameraRequired ? (
            <>
              <div className="bg-gray-50 border border-gray-200 rounded-xl aspect-video relative overflow-hidden flex items-center justify-center">
                {stream ? (
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
                ) : (
                  <div className="text-center">
                    <Camera size={32} className="text-gray-300 mx-auto mb-3" />
                    <p className="text-xs font-medium text-gray-400">Camera Preview</p>
                  </div>
                )}
                {!stream && (
                  <button onClick={requestCamera} className="absolute bottom-6 px-6 py-3 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors text-xs font-medium">
                    Enable Camera
                  </button>
                )}
              </div>
              
              {cameraError && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex gap-3 text-rose-600">
                  <AlertTriangle size={18} className="shrink-0" />
                  <p className="text-xs font-medium leading-relaxed">{cameraError}</p>
                </div>
              )}
            </>
          ) : (
            <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-6 text-emerald-950 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-100 text-emerald-700">
                  <CheckCircle size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-emerald-950">Standard Assessment Mode</h3>
                  <p className="text-xs text-emerald-700 mt-0.5">Zero proctoring restrictions • No webcam or microphone required</p>
                </div>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                This assessment is configured without proctoring. You do not need to grant camera or microphone permissions. Click below whenever you are ready to begin.
              </p>
            </div>
          )}

          <ul className="space-y-3 text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-xl">
            {cameraRequired && <li className="flex gap-2"><CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5"/> Ensure you are in a well-lit room.</li>}
            {proctoringActive && <li className="flex gap-2"><CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5"/> Do not switch tabs or minimize the window.</li>}
            <li className="flex gap-2">
              <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5"/>
              {resolvedSections.length > 1
                ? `${resolvedSections.length} Sections — Each section has its own dedicated time limit.`
                : `Time limit: ${assessment.time_limit_minutes || 60} minutes.`}
            </li>
            <li className="flex gap-2">
              <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5"/>
              Ensure you have a stable internet connection before beginning.
            </li>
          </ul>

          {/* Proctoring capability status — show only when proctoring is enabled */}
          {proctoringActive && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Active Proctoring Checks</p>
              </div>
              <div className="divide-y divide-gray-100">
                {[
                  { label: 'Tab Switch & Window Focus', active: proctoringConfig.tab_switch !== false, note: '' },
                  { label: 'Fullscreen Exit Detection', active: proctoringConfig.full_screen !== false, note: '' },
                  { label: 'Audio / Speech Detection', active: proctoringConfig.audio_detect !== false, note: '' },
                  { label: 'Camera Obstruction (Brightness)', active: !!stream && cameraRequired, note: stream ? '' : 'Requires camera' },
                  { label: 'Face Not Visible', active: !!stream && proctoringConfig.face_not_visible !== false, note: stream ? '' : 'Requires camera' },
                  { label: 'Multiple People Detected', active: !!stream && proctoringConfig.multiple_people !== false, note: stream ? '' : 'Requires camera' },
                  { label: 'Gaze & Eye Tracking', active: !!stream && proctoringConfig.eye_tracking !== false, note: stream ? (webGlSupported === false ? '(Geometry mode — limited accuracy)' : '') : 'Requires camera' },
                  { label: 'Head Turn Detection', active: !!stream && proctoringConfig.head_turn !== false, note: stream ? (webGlSupported === false ? '(Geometry mode — limited accuracy)' : '') : 'Requires camera' },
                ].filter(item => item.active || cameraRequired).map(({ label, active, note }) => (
                  <div key={label} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      {active
                        ? <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                        : <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                      }
                      <span className={`text-xs font-medium ${active ? 'text-gray-700' : 'text-gray-400'}`}>{label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!active && note && (
                        <span className="text-xs text-amber-500 font-medium">{note}</span>
                      )}
                      {active && note && (
                        <span className="text-xs text-gray-400">{note}</span>
                      )}
                      {active && (
                        <span className="text-xs text-emerald-500 font-semibold">Active</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button 
            onClick={startAssessment}
            disabled={cameraRequired && !stream} 
            className="w-full py-4 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors shadow-sm disabled:opacity-50 disabled:hover:bg-purple-600"
          >
            Start Assessment
          </button>
        </div>
        ) : (
          <div className="bg-white rounded-2xl p-8 border border-rose-200 shadow-sm space-y-6 text-center">
            <AlertTriangle size={48} className="text-rose-500 mx-auto mb-2 opacity-80" />
            <h2 className="text-xl font-bold text-gray-800">Unsupported Browser</h2>
            <p className="text-sm text-gray-600 leading-relaxed max-w-md mx-auto">
              For security and proctoring reliability, this assessment must be taken using <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong>. 
              <br/><br/>
              Please copy the assessment link and open it in a supported browser to continue.
            </p>
          </div>
        )}
      </div>
    );
  }

  const q = currentQuestion;
  const mins = Math.floor(sectionTimeLeft / 60);
  const secs = sectionTimeLeft % 60;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden light-theme-override text-gray-900">
      {/* Hidden canvas for image processing */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Top Bar */}
      <div className="bg-gray-50 border-b border-gray-200 p-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          {cameraRequired && stream ? (
            <div className="w-12 h-8 rounded border border-gray-200 overflow-hidden relative bg-gray-100">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1] opacity-50" />
              <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center font-bold text-xs shrink-0">
              <Shield size={16} />
            </div>
          )}
          <div>
            <h2 className="text-sm font-semibold text-gray-800 truncate max-w-sm">{assessment.title}</h2>
            {resolvedSections.length > 1 && (
              <p className="text-[11px] font-medium text-purple-700">
                {activeSection?.title || `Section ${activeSectionIdx + 1}`}
              </p>
            )}
          </div>
        </div>
        
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-mono text-sm font-bold ${sectionTimeLeft < 300 ? 'bg-rose-50 border-rose-200 text-rose-600 animate-pulse' : 'bg-white border-gray-200 text-gray-800 shadow-sm'}`}>
          <Clock size={16} className={sectionTimeLeft < 300 ? 'text-rose-600' : 'text-purple-600'} />
          <span>{mins.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}</span>
          <span className="text-[10px] font-sans font-medium text-gray-400 uppercase ml-0.5">Section Time</span>
        </div>
      </div>

      {/* Section Stepper / Header Bar (Shown when multiple sections exist) */}
      {resolvedSections.length > 1 && (
        <div className="bg-gray-100/75 border-b border-gray-200 px-6 py-3">
          <div className="flex items-center gap-3 overflow-x-auto">
            {resolvedSections.map((sec, idx) => {
              const isCompleted = completedSectionIds.includes(sec.id) || idx < activeSectionIdx;
              const isActive = idx === activeSectionIdx;
              const isLocked = idx > activeSectionIdx;

              return (
                <div
                  key={sec.id || idx}
                  className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-semibold shrink-0 transition select-none ${
                    isCompleted
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-not-allowed opacity-90'
                      : isActive
                        ? 'bg-purple-600 text-white shadow-sm ring-2 ring-purple-200'
                        : 'bg-white text-gray-400 border border-gray-200 cursor-not-allowed'
                  }`}
                  title={isCompleted ? 'Section completed (cannot return to this section)' : isActive ? 'Currently active section' : 'Locked — complete previous section to unlock'}
                >
                  {isCompleted && <CheckCircle size={14} className="text-emerald-600" />}
                  {isActive && <Clock size={14} className="text-purple-200" />}
                  {isLocked && <Shield size={14} className="text-gray-400" />}
                  <span>{sec.title}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    isCompleted
                      ? 'bg-emerald-100 text-emerald-800'
                      : isActive
                        ? 'bg-purple-700 text-purple-100'
                        : 'bg-gray-100 text-gray-500'
                  }`}>
                    {isCompleted ? 'Completed' : isActive ? `${sec.time_limit_minutes}m limit` : 'Locked'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {!q ? (
        <div className="p-16 text-center text-gray-500 space-y-4">
          <p className="text-sm">No questions found in this section.</p>
          {activeSectionIdx < resolvedSections.length - 1 ? (
            <button onClick={confirmProceedToNextSection} className="px-6 py-2.5 bg-purple-600 text-white rounded-xl text-xs font-semibold hover:bg-purple-700 transition">
              Proceed to Next Section
            </button>
          ) : (
            <button onClick={() => handleSubmit()} className="px-6 py-2.5 bg-purple-600 text-white rounded-xl text-xs font-semibold hover:bg-purple-700 transition">
              Submit Assessment
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col md:flex-row">
          {/* Left Sidebar - Section Questions List */}
          <div className="md:w-64 bg-gray-50 border-r border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 truncate">
                {activeSection?.title || 'Questions'}
              </h3>
              <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                {currentQIndexInSection + 1} / {activeSectionQuestions.length}
              </span>
            </div>

            {activeSection?.instructions && (
              <p className="text-[11px] text-gray-500 mb-3 bg-white p-2 rounded-lg border border-gray-200 leading-snug">
                {activeSection.instructions}
              </p>
            )}

            <div className="grid grid-cols-4 gap-2">
              {activeSectionQuestions.map((sq, i) => {
                const hasError = errors[sq.id];
                const isAnswered = answers[sq.id] && 
                  (typeof answers[sq.id] === 'string' ? answers[sq.id].trim() : true);
                
                return (
                  <button
                    key={sq.id || i}
                    onClick={() => setCurrentQIndexInSection(i)}
                    className={`aspect-square rounded-lg flex items-center justify-center text-sm font-bold transition-colors relative ${
                      currentQIndexInSection === i 
                        ? hasError ? 'bg-red-500 text-white' : 'bg-purple-600 text-white shadow-sm'
                        : isAnswered 
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' 
                          : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {i + 1}
                    {hasError && currentQIndexInSection !== i && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full text-[8px] text-white flex items-center justify-center">!</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question Area */}
          <div className="flex-1 p-8">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${errors[q.id] ? 'bg-red-50 text-red-600 border-red-200' : 'bg-purple-50 text-purple-600 border-purple-200'}`}>
                  Question {currentQIndexInSection + 1} of {activeSectionQuestions.length}
                  {errors[q.id] && ' ⚠️'}
                </span>
                {resolvedSections.length > 1 && (
                  <span className="text-xs font-medium text-gray-500">
                    ({activeSection?.title})
                  </span>
                )}
              </div>
              <span className="text-xs font-medium text-gray-500">
                {q.marks} Point{q.marks !== 1 ? 's' : ''} | {q.question_type}
              </span>
            </div>

            <div className="mb-8 text-gray-800 leading-relaxed font-medium">
              <div className="prose max-w-none text-gray-900">
                <ReactMarkdown remarkPlugins={[remarkBreaks]}>
                  {q.question_text}
                </ReactMarkdown>
              </div>
              {renderError(q.id)}
            </div>

            {/* MCQ Answer Input (Single Choice) */}
            {q.question_type === 'mcq' && (() => {
              const opts = Array.isArray(q.options) ? q.options : (typeof q.options === 'string' ? (() => { try { return JSON.parse(q.options); } catch { return []; } })() : []);
              const currentAns = answers[q.id] !== undefined ? answers[q.id] : answers[String(q.id)];
              return (
                <div className="space-y-3">
                  {opts.map((opt, i) => (
                    <div 
                      key={i} 
                      onClick={() => {
                        setAnswers(prev => ({ ...prev, [q.id]: opt }));
                        if (errors[q.id]) {
                          setErrors(prev => {
                            const next = { ...prev };
                            delete next[q.id];
                            return next;
                          });
                        }
                      }}
                      className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${currentAns === opt ? 'bg-purple-50 border-purple-300 text-gray-900 font-semibold' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'}`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${currentAns === opt ? 'border-purple-600' : 'border-gray-300'}`}>
                        {currentAns === opt && <div className="w-2.5 h-2.5 rounded-full bg-purple-600" />}
                      </div>
                      <span className="text-sm font-medium">{opt}</span>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* MCQ Multi Answer Input (Multiple Choice) */}
            {q.question_type === 'mcq_multi' && (() => {
              const opts = Array.isArray(q.options) ? q.options : (typeof q.options === 'string' ? (() => { try { return JSON.parse(q.options); } catch { return []; } })() : []);
              const currentList = Array.isArray(answers[q.id]) ? answers[q.id] : (answers[q.id] ? [answers[q.id]] : []);
              return (
                <div className="space-y-3">
                  <p className="text-xs text-gray-400 font-medium italic">Select all options that apply:</p>
                  {opts.map((opt, i) => {
                    const isSelected = currentList.includes(opt);
                    return (
                      <div 
                        key={i} 
                        onClick={() => {
                          const nextList = isSelected ? currentList.filter(x => x !== opt) : [...currentList, opt];
                          setAnswers(prev => ({ ...prev, [q.id]: nextList }));
                          if (errors[q.id]) {
                            setErrors(prev => {
                              const next = { ...prev };
                              delete next[q.id];
                              return next;
                            });
                          }
                        }}
                        className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${isSelected ? 'bg-purple-50 border-purple-300 text-gray-900 font-semibold' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'}`}
                      >
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-purple-600 border-purple-600 text-white' : 'border-gray-300 bg-white'}`}>
                          {isSelected && <span className="text-xs font-bold">✓</span>}
                        </div>
                        <span className="text-sm font-medium">{opt}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Written Answer Input */}
            {q.question_type === 'written' && (
              <textarea
                value={answers[q.id] || ''}
                onChange={e => {
                  const val = e.target.value;
                  setAnswers(prev => ({ ...prev, [q.id]: val }));
                  if (errors[q.id]) {
                    setErrors(prev => {
                      const next = { ...prev };
                      delete next[q.id];
                      return next;
                    });
                  }
                }}
                placeholder="Type your answer here..."
                className={`w-full bg-gray-50 border ${errors[q.id] ? 'border-red-400' : 'border-gray-200'} rounded-xl p-5 text-sm text-gray-900 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all min-h-[300px] resize-y`}
              />
            )}

            {/* Coding Challenge Input */}
            {q.question_type === 'coding' && (
              <div className="flex flex-col h-[500px] border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                <div className="bg-gray-100 px-4 py-2 flex justify-between items-center border-b border-gray-200">
                  <span className="text-xs font-semibold text-purple-600">{q.programming_language || 'javascript'}</span>
                </div>
                <div className={`flex-1 ${errors[q.id] ? 'border-2 border-red-400' : ''}`}>
                  <Editor
                    height="100%"
                    language={(q.programming_language || 'javascript').toLowerCase()}
                    theme="vs-dark"
                    value={answers[q.id] !== undefined ? answers[q.id] : (q.starter_code || '')}
                    onChange={(val) => {
                      setAnswers(prev => ({ ...prev, [q.id]: val }));
                      if (errors[q.id]) {
                        setErrors(prev => {
                          const next = { ...prev };
                          delete next[q.id];
                          return next;
                        });
                      }
                    }}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      scrollBeyondLastLine: false,
                      padding: { top: 16 }
                    }}
                  />
                </div>
              </div>
            )}
            
            {/* Bottom Navigation */}
            <div className="mt-8 pt-6 border-t border-gray-200 flex justify-between items-center">
              <button
                onClick={() => setCurrentQIndexInSection(q => Math.max(0, q - 1))}
                disabled={currentQIndexInSection === 0}
                className="px-6 py-3 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:hover:bg-gray-100 flex items-center gap-2"
              >
                <ChevronLeft size={16} /> Previous
              </button>
              
              {currentQIndexInSection < activeSectionQuestions.length - 1 ? (
                <button
                  onClick={() => setCurrentQIndexInSection(q => q + 1)}
                  className="px-6 py-3 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors flex items-center gap-2 shadow-sm"
                >
                  Next <ChevronRight size={16} />
                </button>
              ) : activeSectionIdx < resolvedSections.length - 1 ? (
                <button
                  onClick={handleProceedToNextSection}
                  className="px-6 py-3 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors flex items-center gap-2 shadow-sm"
                >
                  Complete {activeSection?.title || 'Section'} & Proceed <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  onClick={() => handleSubmit()}
                  disabled={isSubmitting}
                  className="px-8 py-3 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors flex items-center gap-2 shadow-sm"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <><Send size={16} /> Submit Assessment</>}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Next Section Confirmation Modal */}
      {showNextSectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 text-gray-900 light-theme-override">
            <div className="flex items-center gap-3 text-amber-600 mb-3">
              <AlertTriangle size={24} />
              <h3 className="text-lg font-bold text-gray-800">Complete {activeSection?.title}?</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              Are you sure you want to finish <strong>{activeSection?.title}</strong> and proceed to <strong>{resolvedSections[activeSectionIdx + 1]?.title}</strong>?
            </p>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium mb-6 flex items-start gap-2">
              <span>⚠️</span>
              <span>Once you proceed, this section will be locked and you <strong>cannot return</strong> to view or change your answers in this section.</span>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowNextSectionModal(false)}
                className="px-4 py-2 rounded-xl text-gray-600 font-medium hover:bg-gray-100 text-sm transition"
              >
                Stay in Section
              </button>
              <button
                type="button"
                onClick={confirmProceedToNextSection}
                className="px-5 py-2 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700 text-sm transition shadow-sm"
              >
                Confirm & Proceed →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
