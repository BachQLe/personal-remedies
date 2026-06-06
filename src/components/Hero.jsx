import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import TrustStrip from "./TrustStrip";

const SUPERFOODS = [
  {
    emoji: "🧄",
    name: "Garlic",
    tag: "Immune Booster",
    stats: [
      { label: "Immune Support", rating: 10 },
      { label: "Anti-Inflammatory", rating: 9 },
      { label: "Blood Pressure", rating: 8 },
      { label: "Antioxidant", rating: 9 },
      { label: "Antimicrobial", rating: 9 },
    ],
  },
  {
    emoji: "🌿",
    name: "Turmeric",
    tag: "Inflammation Fighter",
    stats: [
      { label: "Anti-Inflammatory", rating: 10 },
      { label: "Joint Health", rating: 9 },
      { label: "Brain Health", rating: 8 },
      { label: "Antioxidant", rating: 9 },
      { label: "Digestive Health", rating: 7 },
    ],
  },
  {
    emoji: "🫐",
    name: "Blueberries",
    tag: "Antioxidant Powerhouse",
    stats: [
      { label: "Antioxidant", rating: 10 },
      { label: "Brain Health", rating: 9 },
      { label: "Heart Health", rating: 8 },
      { label: "Blood Sugar", rating: 7 },
      { label: "Anti-Aging", rating: 9 },
    ],
  },
  {
    emoji: "🥑",
    name: "Avocado",
    tag: "Heart Health Hero",
    stats: [
      { label: "Heart Health", rating: 10 },
      { label: "Healthy Fats", rating: 10 },
      { label: "Blood Pressure", rating: 8 },
      { label: "Eye Health", rating: 7 },
      { label: "Blood Sugar", rating: 8 },
    ],
  },
  {
    emoji: "🥬",
    name: "Spinach",
    tag: "Nutrient Dense",
    stats: [
      { label: "Iron", rating: 9 },
      { label: "Bone Health", rating: 8 },
      { label: "Eye Health", rating: 9 },
      { label: "Heart Health", rating: 8 },
      { label: "Energy", rating: 7 },
    ],
  },
];

const CONDITIONS = [
  { label: "Type 2 Diabetes", color: "bg-amber/15 text-amber-800" },
  { label: "Hypertension", color: "bg-red-50 text-red-700" },
  { label: "High Cholesterol", color: "bg-orange-50 text-orange-700" },
];

const PREFERENCES = ["Plant-based", "Low Sodium", "Nut-free", "Gluten-free"];

const CHAT = [
  { from: "user", text: "I have type 2 diabetes and high blood pressure. Is oatmeal okay for me?" },
  { from: "bot", text: "Steel-cut oats are great for both. Beta-glucan fiber slows blood sugar absorption and reduces LDL — a two-for-one for your conditions." },
  { from: "user", text: "What about fruit? I heard sugar is bad." },
  { from: "bot", text: "Whole fruit is fine — fiber buffers the spike. Blueberries, pears, and apples are ideal. Avoid fruit juice entirely." },
  { from: "user", text: "Can garlic actually lower blood pressure?" },
  { from: "bot", text: "Yes — allicin relaxes blood vessels. Studies show 600–1,200mg daily can cut systolic by 10+ mmHg. Raw or aged extract works best." },
  { from: "user", text: "What should I cut out completely?" },
  { from: "bot", text: "Top three: processed meats, white bread, and sugary drinks. Cutting these typically moves the needle within 4–6 weeks." },
  { from: "user", text: "Any easy meal I can start with tomorrow?" },
  { from: "bot", text: "Overnight oats + blueberries + walnuts. 5 min tonight, zero effort tomorrow — hits 4 of your top nutrients at once. (continue free →)" },
];

// Cursor waypoints as % of the demo widget container
// click:true = trigger a click-scale animation at this position
const CURSOR_WAYPOINTS = [
  { x: "50%", y: "91%", click: false },
  { x: "62%", y: "91%", click: false },
  { x: "57%", y: "91%", click: false },
  { x: "87%", y: "91%", click: true },
  { x: "62%", y: "91%", click: false },
  { x: "68%", y: "91%", click: false },
  { x: "87%", y: "91%", click: true },
  { x: "54%", y: "91%", click: false },
  { x: "62%", y: "91%", click: false },
  { x: "87%", y: "91%", click: true },
  { x: "59%", y: "91%", click: false },
  { x: "62%", y: "91%", click: false },
];

function RatingDots({ filled }) {
  return (
    <div className="flex gap-1 items-center">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`w-2 h-2 rounded-full transition-colors duration-150 ${i <= filled ? "bg-forest" : "border border-forest/25"
            }`}
        />
      ))}
    </div>
  );
}

export default function Hero({ topOffset = 0 }) {
  const navigate = useNavigate();
  const heroRef = useRef(null);
  const canvasRef = useRef(null);
  const [isFixed, setIsFixed] = useState(true);
  const prevFixedRef = useRef(true);


  // Initialize WebGL sunset clouds background
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return;

    function resize() {
      const r = canvas.getBoundingClientRect();
      canvas.width = r.width * Math.min(devicePixelRatio, 1);
      canvas.height = r.height * Math.min(devicePixelRatio, 1);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    const VS = `attribute vec2 a_pos; void main(){ gl_Position=vec4(a_pos,0.,1.); }`;

    const FS = `
      precision highp float;
      uniform vec2  u_res;
      uniform float u_time;

      vec2 hash2(vec2 p){
        p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));
        return -1.+2.*fract(sin(p)*43758.5453);
      }
      float vn(vec2 p){
        vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);
        return mix(
          mix(dot(hash2(i),f),dot(hash2(i+vec2(1,0)),f-vec2(1,0)),u.x),
          mix(dot(hash2(i+vec2(0,1)),f-vec2(0,1)),dot(hash2(i+vec2(1)),f-vec2(1)),u.x),u.y);
      }
      float fbm(vec2 p, int oct){
        float v=0.,a=.5,tot=0.;
        for(int i=0;i<10;i++){
          if(i>=oct)break;
          v+=a*vn(p); tot+=a; a*=.48;
          p=p*2.07+vec2(1.7,9.2);
        }
        return v/tot;
      }

      vec2 cloudSample(vec2 p, int sOct, int dOct){
        vec2 q=vec2(fbm(p,3),fbm(p+vec2(5.2,1.3),3));
        vec2 r=vec2(fbm(p+q+vec2(1.7,9.2),2),fbm(p+q+vec2(8.3,2.8),2));
        float shape=fbm(p+r*0.7,sOct);
        vec2 dq=vec2(fbm(p*2.1+vec2(3.1,7.4)+r*0.4,2),fbm(p*2.1+vec2(8.8,2.1)+r*0.4,2));
        float detail=fbm(p*2.6+dq*0.6+vec2(11.,5.),dOct);
        return vec2(shape,detail);
      }

      float layer(vec2 uv, float scale, float spd, float spd2, float seed, float edgeFade, float threshold, int sOct, int dOct){
        vec2 p=uv*scale+vec2(seed,seed*0.43);
        p.x+=u_time*spd;
        p.y+=u_time*spd2;
        vec2 s=cloudSample(p,sOct,dOct);
        float mask=smoothstep(threshold,threshold+edgeFade,s.x);
        float interior=mix(0.,s.y*0.5+0.5,mask);
        float cloudD=mask*(0.55+interior*0.45);
        float edgeMask=smoothstep(threshold,threshold+edgeFade*2.,s.x);
        cloudD*=mix(0.6+s.y*0.4,1.,edgeMask);
        return clamp(cloudD,0.,1.);
      }

      void main(){
        vec2 uv=gl_FragCoord.xy/u_res;
        float yT=uv.y;

        vec3 skyAmb  = vec3(.85,.52,.25);
        vec3 skyTerra= vec3(.82,.42,.30);
        vec3 sky = mix(skyTerra, skyAmb, smoothstep(0.2, 0.8, yT));

        float sunY = 0.38;
        float sunX = 0.52;
        vec2 sunPos = vec2(sunX, sunY);
        float sunDist = length(uv - sunPos);
        float sunGlow = exp(-sunDist*sunDist*18.)*0.65
                      + exp(-sunDist*sunDist*4.0)*0.30;
        sky += vec3(1.0,.72,.28)*sunGlow;
        sky  = clamp(sky,0.,1.);

        float pStretch=1.0+(1.-yT)*1.3;
        vec2 pUV=vec2(uv.x*pStretch,uv.y);

        float altMF  = smoothstep(.46,.56,yT)*smoothstep(.62,.55,yT);
        float dMF    = layer(pUV,4.0,0.015,-0.002,  23.7, 0.10,0.05,5,4)*altMF*0.75;

        float altMid = smoothstep(.36,.46,yT)*smoothstep(.54,.47,yT);
        float dMid   = layer(pUV,2.8,0.024, 0.001,  47.1, 0.09,0.04,6,5)*altMid*0.92;

        float nScale = 1.0+(1.-yT)*0.8;
        vec2 nUV     = vec2(pUV.x*nScale,pUV.y);
        float altNear= smoothstep(.30,.38,yT)*smoothstep(.44,.38,yT);
        float dNear  = layer(nUV,2.0,0.038,-0.001, 81.9, 0.07,0.05,7,6)*altNear*1.0;

        float d=max(dNear,max(dMid*(1.-dNear*.55),dMF*(1.-dMid*.5)*(1.-dNear*.7)));

        vec3 cloudEdge  = vec3(1.0,.90,.65);
        vec3 cloudMid   = vec3(.95,.65,.30);
        vec3 cloudShadow= vec3(.78,.50,.65);
        vec3 cloudBase  = vec3(.68,.40,.50);

        float sunProx = exp(-sunDist*sunDist*6.)*0.8 + 0.2;

        float thick=clamp(d,0.,1.);
        vec3 cloudCol;
        cloudCol = mix(cloudEdge, cloudMid,   smoothstep(.10,.50,thick));
        cloudCol = mix(cloudCol,  cloudShadow,smoothstep(.55,.90,thick));
        cloudCol = mix(cloudCol,  cloudBase,  smoothstep(.80,1.0, thick));

        vec3 sunBloom = vec3(1.0,.95,.75);
        cloudCol = mix(cloudCol, sunBloom, sunProx*smoothstep(.6,1.,1.-thick)*0.75);

        float rimGlow = smoothstep(.08,.22,d)*(1.-smoothstep(.22,.50,d));
        cloudCol = mix(cloudCol, vec3(1.0,.80,.40), rimGlow*sunProx*0.80);

        float terraBleed = smoothstep(.38,.55,d)*(1.-smoothstep(.55,.80,d));
        cloudCol = mix(cloudCol, vec3(.88,.45,.30), terraBleed*(1.-yT)*0.55);

        float alpha=smoothstep(0.,.65,d);
        vec3 col=mix(sky,cloudCol,alpha);

        float vig=1.-smoothstep(.55,1.4,length((uv-vec2(.5,.5))*vec2(1.,.8)));
        col*=mix(.72,1.,vig);

        gl_FragColor=vec4(clamp(col,0.,1.),1.);
      }
    `;

    function mkShader(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
      return s;
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, mkShader(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, mkShader(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aloc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(aloc);
    gl.vertexAttribPointer(aloc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, 'u_res');
    const uTime = gl.getUniformLocation(prog, 'u_time');

    resize();
    window.addEventListener('resize', resize);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t0 = performance.now();
    let lastFrameTime = 0;
    let frameScheduled = false;

    function frame() {
      const now = performance.now();
      if (now - lastFrameTime >= 33) {
        const t = prefersReducedMotion ? 0 : (now - t0) * 0.001;
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uTime, t);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        lastFrameTime = now;
      }
      frameScheduled = requestAnimationFrame(frame);
    }
    frameScheduled = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(frameScheduled);
      window.removeEventListener('resize', resize);
    };
  }, []);

  useEffect(() => {
    const check = () => {
      if (!heroRef.current) return;
      const { bottom } = heroRef.current.getBoundingClientRect();
      const shouldBeFixed = bottom > window.innerHeight;
      if (shouldBeFixed !== prevFixedRef.current) {
        prevFixedRef.current = shouldBeFixed;
        setIsFixed(shouldBeFixed);
      }
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, []);


  // Superfood cycling
  const [activeIdx, setActiveIdx] = useState(0);

  // Chat simulation — messages array grows forever, never clears
  const [messages, setMessages] = useState(CHAT.slice(0, 2));
  const [inputText, setInputText] = useState("");
  const [showTyping, setShowTyping] = useState(false);

  // Cursor
  const [cursorIdx, setCursorIdx] = useState(0);
  const [isClicking, setIsClicking] = useState(false);

  // One-time delay before typing starts
  const [chatStarted, setChatStarted] = useState(false);

  // Animated filled-dot counts and rating numbers for step animation
  const [animatedFilled, setAnimatedFilled] = useState(
    SUPERFOODS[0].stats.map(s => Math.round(s.rating / 2))
  );
  const [animatedRatings, setAnimatedRatings] = useState(
    SUPERFOODS[0].stats.map(s => s.rating)
  );
  const animRef = useRef({
    timeouts: [],
    startFilled: SUPERFOODS[0].stats.map(s => Math.round(s.rating / 2)),
    startRatings: SUPERFOODS[0].stats.map(s => s.rating),
  });

  // ── Superfood cycle ──────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setActiveIdx((p) => (p + 1) % SUPERFOODS.length), 3500);
    return () => clearInterval(id);
  }, []);

  // ── Orb + number step animation on food change ───────────────
  useEffect(() => {
    animRef.current.timeouts.forEach(clearTimeout);
    animRef.current.timeouts = [];

    const startFilled = [...animRef.current.startFilled];
    const startRatings = [...animRef.current.startRatings];
    const targetFilled = SUPERFOODS[activeIdx].stats.map(s => Math.round(s.rating / 2));
    const targetRatings = SUPERFOODS[activeIdx].stats.map(s => s.rating);

    const maxSteps = Math.max(
      ...targetFilled.map((t, i) => Math.abs(t - startFilled[i])),
      ...targetRatings.map((t, i) => Math.abs(t - startRatings[i]))
    );

    if (maxSteps === 0) {
      animRef.current.startFilled = targetFilled;
      animRef.current.startRatings = targetRatings;
      setAnimatedFilled(targetFilled);
      setAnimatedRatings(targetRatings);
      return;
    }

    let curFilled = [...startFilled];
    let curRatings = [...startRatings];
    for (let step = 1; step <= maxSteps; step++) {
      curFilled = curFilled.map((c, i) => c < targetFilled[i] ? c + 1 : c > targetFilled[i] ? c - 1 : c);
      curRatings = curRatings.map((c, i) => c < targetRatings[i] ? c + 1 : c > targetRatings[i] ? c - 1 : c);
      const snapFilled = [...curFilled];
      const snapRatings = [...curRatings];
      const t = setTimeout(() => {
        setAnimatedFilled(snapFilled);
        setAnimatedRatings(snapRatings);
        animRef.current.startFilled = snapFilled;
        animRef.current.startRatings = snapRatings;
      }, step * 110);
      animRef.current.timeouts.push(t);
    }
  }, [activeIdx]);

  // ── Initial typing delay ─────────────────────────────────────
  useEffect(() => {
    const id = setTimeout(() => setChatStarted(true), 2800);
    return () => clearTimeout(id);
  }, []);

  // ── User typing into input ────────────────────────────────────
  useEffect(() => {
    if (!chatStarted) return;
    const msg = CHAT[messages.length % CHAT.length];
    if (msg.from !== "user") return;

    const target = msg.text;
    if (inputText.length < target.length) {
      const id = setTimeout(() => setInputText(target.slice(0, inputText.length + 1)), 36);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => {
      setInputText("");
      setMessages((prev) => [...prev, msg]);
    }, 420);
    return () => clearTimeout(id);
  }, [messages.length, inputText, chatStarted]);

  // ── Bot response ──────────────────────────────────────────────
  useEffect(() => {
    if (!chatStarted) return;
    const msg = CHAT[messages.length % CHAT.length];
    if (msg.from !== "bot") return;
    setShowTyping(true);
    const id = setTimeout(() => {
      setShowTyping(false);
      setMessages((prev) => [...prev, msg]);
    }, 1800);
    return () => clearTimeout(id);
  }, [messages.length, chatStarted]);

  // ── Cursor waypoints ──────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setCursorIdx((i) => (i + 1) % CURSOR_WAYPOINTS.length), 4000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!CURSOR_WAYPOINTS[cursorIdx].click) return;
    setIsClicking(true);
    const id = setTimeout(() => setIsClicking(false), 240);
    return () => clearTimeout(id);
  }, [cursorIdx]);

  const food = SUPERFOODS[activeIdx];
  const wp = CURSOR_WAYPOINTS[cursorIdx];

  return (
    <section
      ref={heroRef}
      className="relative overflow-hidden pb-[108px]"
      style={{ marginTop: -topOffset, paddingTop: topOffset + 64 }}
    >
      {/* WebGL sunset clouds background */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ top: 0, left: 0, zIndex: 0 }}
      />

      {/* dark overlay for readability */}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.12)', zIndex: 1 }} />

      {/* shared hand-drawn filter */}
      <svg aria-hidden className="absolute w-0 h-0 overflow-hidden">
        <defs>
          <filter id="sketchy" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="8" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>


      <div className="mx-auto max-w-7xl container-px relative z-20">

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="display text-[48px] leading-[1.04] sm:text-[48px] sm:leading-[1.02] lg:text-[64px] lg:leading-[1.0] text-white text-center"
        >
          <span className="relative inline-block">
            Less pills,{" "}
            <em className="font-display italic font-normal text-white">more real food</em>
            {/* hand-drawn underline */}
            <motion.svg
              aria-hidden
              className="absolute pointer-events-none"
              style={{ left: "-4%", width: "108%", bottom: "-0.18em", height: "0.34em", overflow: "visible" }}
              viewBox="0 0 340 18"
              preserveAspectRatio="none"
              fill="none"
              opacity="0.10"
              stroke="#C9973A"
              strokeWidth="3.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <motion.path
                d="M4 11C56 6 110 5 168 7C226 9 282 8 336 5"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.85, ease: [0.22, 1, 0.36, 1] }}
              />
              <motion.path
                d="M10 15C66 12 134 12 200 13C244 13.6 290 13 330 11"
                stroke="#C9973A"
                strokeWidth="2.2"
                opacity="0.10"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.7, delay: 1.0, ease: [0.22, 1, 0.36, 1] }}
              />
            </motion.svg>
          </span>

        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="mt-4 max-w-[34ch] mx-auto text-[17px] sm:text-[19px] leading-snug text-white/85 text-center tracking-tight"
        >
          A simple diet change can reverse many chronic conditions — the question is{" "}
          <em className="font-display italic text-white">what foods to eat.</em>
        </motion.p>

        <div className="relative z-10 flex flex-col items-center mt-8">
          <button
            onClick={() => navigate("/survey")}
            className="pill-btn !rounded-2xl text-white hover:-translate-y-[1px] hover:shadow-lift text-[16px] px-7 py-3 font-semibold"
            style={{ background: "#1B3A2D" }}
          >
            Get your personalized plan
          </button>
          <p className="mt-3 text-center text-[11px] sm:text-[12px] text-white/80 tracking-tight">
            Built on 100k+ real scientific articles, for real, unique people
          </p>
        </div>

        {/* section label — signals "this is the product" */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="mt-12 flex items-center justify-center gap-3"
        >
          <span className="h-px w-8" style={{ background: 'rgba(255,255,255,0.25)' }} />
          <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-white/60">
            See it in action
          </span>
          <span className="h-px w-8" style={{ background: 'rgba(255,255,255,0.25)' }} />
        </motion.div>

        {/* ── unified app window ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 mt-6 mx-auto max-w-5xl rounded-[5px] bg-white border border-ink/[0.08] shadow-lift overflow-hidden"
          style={{
            boxShadow: `0 0 60px rgba(100, 150, 200, 0.4), 0 25px 50px -12px rgba(0, 0, 0, 0.25)`
          }}
        >
          {/* cursor overlay */}
          <motion.div
            className="absolute z-50 pointer-events-none"
            animate={{ left: wp.x, top: wp.y, scale: isClicking ? 0.72 : 1 }}
            transition={{ left: { duration: 0.75, ease: [0.22, 1, 0.36, 1] }, top: { duration: 0.75, ease: [0.22, 1, 0.36, 1] }, scale: { duration: 0.12 } }}
          >
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
              <path
                d="M2 2 L2 16 L5.5 12.5 L8 18.5 L10 17.5 L7.5 11.5 L13 11.5 Z"
                fill="white"
                stroke="#1a1a1a"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>

          {/* chrome bar */}
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-black/[0.10]" style={{ background: "linear-gradient(90deg, #0EA5E9 0%, #06B6D4 40%, #103db9ff 100%)", boxShadow: "0 0 30px rgba(6, 182, 212, 0.6), 0 0 60px rgba(16, 185, 129, 0.3)" }}>
            <span className="h-2.5 w-2.5 rounded-full bg-amber animate-slow-pulse" />
            <span className="text-[13px] font-medium tracking-tight text-white">
              Nutri <span className="text-white/50">·</span>{" "}
              <span className="text-white/80">Personal Remedies</span>
            </span>
            <span className="ml-auto text-[11px] text-white/60">demo</span>
          </div>

          {/* two-pane body */}
          <div className="flex divide-x divide-ink/[0.06]" style={{ minHeight: 420 }}>

            {/* LEFT PANEL */}
            <div className="w-[42%] shrink-0 flex flex-col" style={{ background: "#E7EEE7" }}>

              {/* Nutri Recommendations */}
              <div className="px-4 pt-4 pb-3 border-b border-black/[0.06]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-semibold tracking-widest uppercase text-ink/40">
                    Nutri Recommendations
                  </span>
                  <span className="flex gap-1">
                    {SUPERFOODS.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveIdx(i)}
                        className={`h-1.5 rounded-full transition-all duration-300 ${i === activeIdx ? "bg-forest w-4" : "bg-ink/20 w-1.5"
                          }`}
                      />
                    ))}
                  </span>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={food.name}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="flex items-center gap-2.5 mb-3"
                  >
                    <span className="text-3xl leading-none select-none" aria-hidden>{food.emoji}</span>
                    <div>
                      <p className="text-[14px] font-semibold tracking-tight text-ink leading-none">{food.name}</p>
                      <p className="text-[11px] text-ink/45 mt-0.5">{food.tag}</p>
                    </div>
                  </motion.div>
                </AnimatePresence>
                <div className="space-y-2">
                  {food.stats.map(({ label }, rowIdx) => (
                    <div key={rowIdx} className="flex items-center justify-between gap-2">
                      <span className="text-[12px] text-ink/60 truncate">{label}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="flex items-center gap-1 -mr-1">
                          <RatingDots filled={animatedFilled[rowIdx]} />
                          <span className="overflow-hidden" style={{ height: 16, width: 14 }}>
                            <AnimatePresence mode="popLayout" initial={false}>
                              <motion.span
                                key={animatedRatings[rowIdx]}
                                initial={{ y: -10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: 10, opacity: 0 }}
                                transition={{ duration: 0.1, ease: "easeInOut" }}
                                className="text-[11px] font-semibold text-ink block"
                              >
                                {animatedRatings[rowIdx]}
                              </motion.span>
                            </AnimatePresence>
                          </span>
                        </span>
                        <span className="text-[11px] text-ink/30 font-normal">/10</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Your Profile */}
              <div className="px-4 pt-3 pb-4 flex-1">
                <p className="text-[11px] font-semibold tracking-widest uppercase text-ink/40 mb-2.5">
                  Your Profile
                </p>
                <p className="text-[11px] text-ink/50 mb-1.5 font-medium">Conditions</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {CONDITIONS.map(({ label, color }) => (
                    <span key={label} className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${color}`}>
                      {label}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-ink/50 mb-1.5 font-medium">Preferences</p>
                <div className="flex flex-wrap gap-1.5">
                  {PREFERENCES.map((pref) => (
                    <span key={pref} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-forest/10 text-forest">
                      {pref}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT PANEL — chat */}
            <div className="flex-1 flex flex-col">
              {/*
                flex-col-reverse + overflow-hidden:
                newest message is first in DOM → appears at bottom.
                as chat fills, oldest messages push up and clip at the top edge.
              */}
              <div
                className="flex-1 flex flex-col-reverse overflow-hidden bg-[#ECEFF5]"
                style={{ padding: "20px", gap: "14px", maxHeight: 360 }}
              >
                {/* typing indicator — first in DOM = very bottom */}
                {showTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-start shrink-0"
                  >
                    <div className="bg-white border border-ink/[0.06] rounded-2xl rounded-tl-md px-4 py-3 flex items-center gap-1.5">
                      {[0, 0.18, 0.36].map((d) => (
                        <span
                          key={d}
                          className="h-1.5 w-1.5 rounded-full bg-ink/30 animate-slow-pulse"
                          style={{ animationDelay: `${d}s` }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* messages — newest first in DOM (column-reverse shows newest at bottom) */}
                {[...messages].reverse().map((m, reversedIdx) => {
                  const originalIdx = messages.length - 1 - reversedIdx;
                  return (
                    <motion.div
                      key={originalIdx}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                      className={`flex shrink-0 ${m.from === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13.5px] leading-[1.55] ${m.from === "user"
                          ? "text-white rounded-tr-md"
                          : "bg-white text-ink rounded-tl-md border border-ink/[0.06]"
                          }`}
                        style={m.from === "user" ? { background: "linear-gradient(135deg, #1B3A2D 0%, #3c5e49 60%, #7A9E7E 100%)" } : {}}
                      >
                        {m.text}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* input bar */}
              <div className="px-4 py-3 border-t border-ink/[0.06] flex items-center gap-2 bg-white">
                <div className="flex-1 rounded-full bg-[#ECEFF5] px-4 py-2 text-[13px] border border-ink/[0.06] flex items-center min-w-0">
                  {inputText ? (
                    <>
                      <span className="text-ink truncate">{inputText}</span>
                      <span className="ml-px inline-block w-[1.5px] h-3.5 bg-ink/70 shrink-0 animate-slow-pulse" />
                    </>
                  ) : (
                    <span className="text-ink/40">Ask Nutri anything…</span>
                  )}
                </div>
                <button
                  className="h-8 w-8 rounded-full text-white flex items-center justify-center shrink-0"
                  style={{ background: "linear-gradient(135deg, #1B3A2D 0%, #7A9E7E 100%)" }}
                >
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                    <path d="M7 12V2M7 2 2 7M7 2l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>

          </div>
        </motion.div>

      </div>

      <div
        className={`left-6 right-6 z-40 ${isFixed ? "fixed bottom-0" : "absolute bottom-0"}`}
      >
        <TrustStrip />
      </div>
    </section>
  );
}
