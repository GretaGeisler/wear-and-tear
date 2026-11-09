// ---- multicolour grain texture (random RGB pixels, tiled over the whole screen) ----
(function () {
  var c = document.createElement("canvas");
  c.width = c.height = 512;
  var x = c.getContext("2d"),
    d = x.createImageData(512, 512);
  for (var i = 0; i < d.data.length; i += 4) {
    d.data[i] = Math.random() * 255;
    d.data[i + 1] = Math.random() * 255;
    d.data[i + 2] = Math.random() * 255;
    d.data[i + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  document.getElementById("grain").style.backgroundImage =
    "url(" + c.toDataURL() + ")";
})();
