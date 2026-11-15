// Wear and Tear – SVG filters (metal background + poster-style text).
// Include on EVERY page, directly after <body> and BEFORE burn.js:
//   <script src="/filters.js"></script>
(function () {
  "use strict";
  if (!document.body || document.getElementById("metal")) return;

  var svg = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true">

<!-- ===================== METAL BACKGROUND (#tex) ===================== -->
<filter id="metal" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
  <feColorMatrix in="SourceGraphic" type="saturate" values="0" result="gray"/>
  <feGaussianBlur id="fTone" in="gray" stdDeviation="3.5" result="tone"/>
  <feGaussianBlur in="gray" stdDeviation="0.6" result="soft"/>
  <feConvolveMatrix in="soft" order="3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" divisor="1" bias="0.5" preserveAlpha="true" edgeMode="duplicate" result="lap"/>
  <feComponentTransfer in="lap" result="amp">
    <feFuncR type="linear" slope="5" intercept="-2"/><feFuncG type="linear" slope="5" intercept="-2"/><feFuncB type="linear" slope="5" intercept="-2"/>
  </feComponentTransfer>
  <feComponentTransfer in="amp" result="lines">
    <feFuncR type="table" tableValues="1 .55 0 0 0 .55 1"/><feFuncG type="table" tableValues="1 .55 0 0 0 .55 1"/><feFuncB type="table" tableValues="1 .55 0 0 0 .55 1"/>
  </feComponentTransfer>
  <feGaussianBlur in="lines" stdDeviation="0.5" result="bevel"/>
  <feTurbulence id="fNoise" type="fractalNoise" baseFrequency="0.3" numOctaves="3" seed="5" result="n1"/>
  <feColorMatrix in="n1" type="matrix" values=".33 .33 .33 0 0  .33 .33 .33 0 0  .33 .33 .33 0 0  0 0 0 0 1" result="nz"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="11" result="n2"/>
  <feColorMatrix in="n2" type="matrix" values=".33 .33 .33 0 0  .33 .33 .33 0 0  .33 .33 .33 0 0  0 0 0 0 1" result="wb"/>
  <feComposite id="hA" in="tone" in2="bevel" operator="arithmetic" k1="0" k2="0.75" k3="0.5" k4="0" result="h1"/>
  <feComposite id="hB" in="h1" in2="nz" operator="arithmetic" k1="0" k2="1" k3="0.05" k4="-0.025" result="h2"/>
  <feComposite id="hC" in="h2" in2="wb" operator="arithmetic" k1="0" k2="1" k3="0.1" k4="-0.05" result="h3"/>
  <feGaussianBlur id="fSmooth" in="h3" stdDeviation="0" result="h4"/>
  <feColorMatrix in="h4" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" result="bump"/>
  <feDiffuseLighting id="fDiff" in="bump" surfaceScale="1.8" diffuseConstant="0.4" lighting-color="#fff" result="diff">
    <feDistantLight id="lD" azimuth="225" elevation="47"/>
  </feDiffuseLighting>
  <feSpecularLighting id="fSpec" in="bump" surfaceScale="1.8" specularConstant="1.2" specularExponent="45" lighting-color="#fff" result="spec">
    <feDistantLight id="lS" azimuth="225" elevation="47"/>
  </feSpecularLighting>
  <feSpecularLighting id="fSpec2" in="bump" surfaceScale="1.8" specularConstant="0.25" specularExponent="7" lighting-color="#fff" result="spec2">
    <feDistantLight id="lS2" azimuth="225" elevation="47"/>
  </feSpecularLighting>
  <feComposite in="diff" in2="spec" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="lit0"/>
  <feComposite in="lit0" in2="spec2" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="lit1"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.008 0.7" numOctaves="2" seed="21" result="br"/>
  <feColorMatrix in="br" type="matrix" values=".33 .33 .33 0 0  .33 .33 .33 0 0  .33 .33 .33 0 0  0 0 0 0 1" result="brg"/>
  <feComposite id="fBrush" in="lit1" in2="brg" operator="arithmetic" k1="0" k2="1" k3="0.07" k4="-0.035" result="lit"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.0025 0.006" numOctaves="2" seed="3" result="sw"/>
  <feColorMatrix in="sw" type="matrix" values=".33 .33 .33 0 0  .33 .33 .33 0 0  .33 .33 .33 0 0  0 0 0 0 1" result="swg"/>
  <feComposite id="fSheen" in="lit" in2="swg" operator="arithmetic" k1="0" k2="1" k3="0.35" k4="-0.175" result="sheen"/>
  <feComponentTransfer in="sheen" result="tn">
    <feFuncR id="cR" type="linear" slope="1.25" intercept="-0.095"/><feFuncG id="cG" type="linear" slope="1.25" intercept="-0.095"/><feFuncB id="cB" type="linear" slope="1.25" intercept="-0.095"/>
  </feComponentTransfer>
  <feColorMatrix in="tn" type="matrix" values=".97 0 0 0 0  0 .99 0 0 0  0 0 1.04 0 0  0 0 0 1 0"/>
</filter>r

<!-- ===================== BIG TEXT: title + list ===================== -->
<filter id="xerox" x="-15%" y="-60%" width="130%" height="220%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed="8" result="n"/>
  <feDisplacementMap in="SourceGraphic" in2="n" scale="4.5" xChannelSelector="R" yChannelSelector="G" result="rough"/>
  <feGaussianBlur in="rough" stdDeviation="0.4" result="core00"/>
  <feTurbulence type="fractalNoise" baseFrequency="1.3" numOctaves="2" seed="17" result="tx"/>
  <feColorMatrix in="tx" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  3.4 0 0 0 -0.95" result="txm"/>
  <feComposite in="core00" in2="txm" operator="in" result="core0"/>
  <feComponentTransfer in="core0" result="core">
    <feFuncR type="linear" slope="1.25" intercept="0.08"/>
    <feFuncG type="linear" slope="1.25" intercept="0.08"/>
    <feFuncB type="linear" slope="1.25" intercept="0.08"/>
    <feFuncA type="linear" slope="0.9"/>
  </feComponentTransfer>
  <feColorMatrix in="rough" type="matrix" values="0 0 0 0 .95  0 0 0 0 .97  0 0 0 0 .97  0 0 0 1 0" result="white"/>
  <feGaussianBlur in="white" stdDeviation="2.2" result="g1"/>
  <feGaussianBlur in="white" stdDeviation="7" result="g2"/>
  <feComponentTransfer in="g1" result="g1a"><feFuncA type="linear" slope="1.1"/></feComponentTransfer>
  <feComponentTransfer in="g2" result="g2a"><feFuncA type="linear" slope="0.6"/></feComponentTransfer>
  <feGaussianBlur in="white" stdDeviation="0.8 16" result="st"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.4 0.006" numOctaves="2" seed="2" result="sn"/>
  <feColorMatrix in="sn" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.2 0 0 0 -0.55" result="sm"/>
  <feComposite in="st" in2="sm" operator="in" result="st2"/>
  <feComponentTransfer in="st2" result="st3"><feFuncA type="linear" slope="0.8"/></feComponentTransfer>
  <feMerge>
    <feMergeNode in="g2a"/>
    <feMergeNode in="g1a"/>
    <feMergeNode in="st3"/>
    <feMergeNode in="core"/>
  </feMerge>
</filter>

<!-- ===================== SMALL TEXT: corner info, intro, buttons ===================== -->
<filter id="xerox-s" x="-20%" y="-200%" width="140%" height="500%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="8" result="n"/>
  <feDisplacementMap in="SourceGraphic" in2="n" scale="1.1" xChannelSelector="R" yChannelSelector="G" result="rough"/>
  <feGaussianBlur in="rough" stdDeviation="0.25" result="core00"/>
  <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="17" result="tx"/>
  <feColorMatrix in="tx" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.4 0 0 0 -0.5" result="txm"/>
  <feComposite in="core00" in2="txm" operator="in" result="core0"/>
  <feComponentTransfer in="core0" result="core">
    <feFuncR type="linear" slope="1.2" intercept="0.06"/>
    <feFuncG type="linear" slope="1.2" intercept="0.06"/>
    <feFuncB type="linear" slope="1.2" intercept="0.06"/>
    <feFuncA type="linear" slope="0.9"/>
  </feComponentTransfer>
  <feColorMatrix in="rough" type="matrix" values="0 0 0 0 .95  0 0 0 0 .97  0 0 0 0 .97  0 0 0 1 0" result="white"/>
  <feGaussianBlur in="white" stdDeviation="1.1" result="g1"/>
  <feGaussianBlur in="white" stdDeviation="3.5" result="g2"/>
  <feComponentTransfer in="g1" result="g1a"><feFuncA type="linear" slope="0.8"/></feComponentTransfer>
  <feComponentTransfer in="g2" result="g2a"><feFuncA type="linear" slope="0.35"/></feComponentTransfer>
  <feGaussianBlur in="white" stdDeviation="0.4 6" result="st"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.4 0.01" numOctaves="2" seed="2" result="sn"/>
  <feColorMatrix in="sn" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.2 0 0 0 -0.55" result="sm"/>
  <feComposite in="st" in2="sm" operator="in" result="st2"/>
  <feComponentTransfer in="st2" result="st3"><feFuncA type="linear" slope="0.45"/></feComponentTransfer>
  <feMerge>
    <feMergeNode in="g2a"/>
    <feMergeNode in="g1a"/>
    <feMergeNode in="st3"/>
    <feMergeNode in="core"/>
  </feMerge>
</filter>

</svg>`;

  document.body.insertAdjacentHTML("afterbegin", svg);
})();
