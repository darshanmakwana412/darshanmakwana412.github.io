// Grab HTML elements
const canvas = document.getElementById('gaussianCanvas');
const ctx = canvas.getContext('2d');

// Sliders
const posXSlider    = document.getElementById('posX');
const posYSlider    = document.getElementById('posY');
const scaleXSlider  = document.getElementById('scaleX');
const scaleYSlider  = document.getElementById('scaleY');
const rotationSlider= document.getElementById('rotation');
const colorPicker   = document.getElementById('colorPicker');
const opacitySlider = document.getElementById('opacity');

// Span to display numeric values
const posXVal   = document.getElementById('posXVal');
const posYVal   = document.getElementById('posYVal');
const scaleXVal = document.getElementById('scaleXVal');
const scaleYVal = document.getElementById('scaleYVal');
const rotationVal = document.getElementById('rotationVal');
const opacityVal  = document.getElementById('opacityVal');

// Initialize displayed values
posXVal.textContent   = posXSlider.value;
posYVal.textContent   = posYSlider.value;
scaleXVal.textContent = scaleXSlider.value;
scaleYVal.textContent = scaleYSlider.value;
rotationVal.textContent = rotationSlider.value;
opacityVal.textContent  = opacitySlider.value;

// Attach event listeners
posXSlider.addEventListener('input',   draw);
posYSlider.addEventListener('input',   draw);
scaleXSlider.addEventListener('input', draw);
scaleYSlider.addEventListener('input', draw);
rotationSlider.addEventListener('input', draw);
colorPicker.addEventListener('input',  draw);
opacitySlider.addEventListener('input', draw);

/**
 * Draws a single rotated 2D Gaussian onto the canvas at the current slider settings.
 */
function draw() {
// Update displayed slider values
posXVal.textContent    = posXSlider.value;
posYVal.textContent    = posYSlider.value;
scaleXVal.textContent  = scaleXSlider.value;
scaleYVal.textContent  = scaleYSlider.value;
rotationVal.textContent= rotationSlider.value;
opacityVal.textContent = opacitySlider.value;

// Clear the canvas
ctx.clearRect(0, 0, canvas.width, canvas.height);

// Retrieve parameters from sliders
const meanX   = parseFloat(posXSlider.value);
const meanY   = parseFloat(posYSlider.value);
const sigmaX  = parseFloat(scaleXSlider.value);
const sigmaY  = parseFloat(scaleYSlider.value);
const rotationDeg = parseFloat(rotationSlider.value);
const rotationRad = rotationDeg * Math.PI / 180.0;
const color   = colorPicker.value;   // e.g. "#ff0000"
const alpha   = parseFloat(opacitySlider.value);

// Convert color from hex to RGB
const rgb = hexToRGB(color); // {r, g, b}

// We’ll do a simple pixel-based approach for demonstration.
// 1. Create an ImageData buffer
const imgData = ctx.createImageData(canvas.width, canvas.height);
const data = imgData.data; // RGBA array: [r, g, b, a,  r, g, b, a, ...]

// Precompute rotation matrix for the Gaussian
//   [ cosθ   sinθ ]
//   [-sinθ   cosθ ]
// We'll transform the (x-meanX, y-meanY) to (dx_rot, dy_rot).
const cosA = Math.cos(rotationRad);
const sinA = Math.sin(rotationRad);

// Fill the image pixel by pixel
for (let py = 0; py < canvas.height; py++) {
    for (let px = 0; px < canvas.width; px++) {

    // Pixel index in image data
    // Each pixel uses 4 array positions: (r, g, b, a)
    const idx = 4 * (py * canvas.width + px);

    // Center the pixel coordinates
    const xCenter = px + 0.5;
    const yCenter = py + 0.5;

    // dx, dy from the Gaussian mean
    const dx = xCenter - meanX;
    const dy = yCenter - meanY;

    // Rotate (dx, dy) by angle:
    //   [ dx_rot ] = [  cosA  +sinA ] [ dx ]
    //   [ dy_rot ]   [ -sinA   cosA ] [ dy ]
    const dx_rot =  dx * cosA + dy * sinA;
    const dy_rot = -dx * sinA + dy * cosA;

    // Gaussian exponent
    //   exponent = (dx_rot^2 / 2σx^2) + (dy_rot^2 / 2σy^2)
    const exponent = (dx_rot*dx_rot) / (2.0*sigmaX*sigmaX) 
                    + (dy_rot*dy_rot) / (2.0*sigmaY*sigmaY);

    // Gaussian value = e^(-exponent)
    const gaussVal = Math.exp(-exponent);

    // Final alpha coverage = alpha * gaussVal
    const coverage = alpha * gaussVal;

    // "Over" blending on a blank background is simply coverage for the final alpha
    // color = coverage * (rgb)  [since background is white or blank, we treat it as if alpha=0]
    // If you wanted to do layering, you'd add it to a background color with over-blend.
    data[idx + 0] = rgb.r;  // red
    data[idx + 1] = rgb.g;  // green
    data[idx + 2] = rgb.b;  // blue
    data[idx + 3] = Math.round(coverage * 255);  // alpha in [0..255]
    }
}

// Put the computed image data onto the canvas
ctx.putImageData(imgData, 0, 0);
}

// Helper: convert a hex color (e.g. "#ff0000") to {r, g, b}
function hexToRGB(hexStr) {
// Remove '#' if present
const hex = hexStr.replace(/^#/, '');
let r = parseInt(hex.substring(0, 2), 16);
let g = parseInt(hex.substring(2, 4), 16);
let b = parseInt(hex.substring(4, 6), 16);
return { r, g, b };
}

// Initial draw
draw();