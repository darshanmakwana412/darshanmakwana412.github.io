/***********************************************************************
 * GLOBAL VARIABLES & INIT
 ***********************************************************************/
const canvas = document.getElementById('multiGaussiansCanvas');
const ctx = canvas.getContext('2d');

const numGaussiansSlider = document.getElementById('numGaussians');
const numGaussiansVal    = document.getElementById('numGaussiansVal');
const scaleMultSlider    = document.getElementById('scaleMultiplier');
const scaleMultVal       = document.getElementById('scaleMultiplierVal');

// We'll store our Gaussians in an array of objects
// Each Gaussian: { meanX, meanY, sigmaX, sigmaY, r, g, b, alpha }
let gaussians = [];

// Canvas size
const WIDTH = canvas.width;
const HEIGHT = canvas.height;

/***********************************************************************
 * EVENT LISTENERS
 ***********************************************************************/
numGaussiansSlider.addEventListener('input', () => {
numGaussiansVal.textContent = numGaussiansSlider.value;
// Re-initialize random Gaussians with new count
initializeGaussians();
draw();
});

scaleMultSlider.addEventListener('input', () => {
scaleMultVal.textContent = scaleMultSlider.value;
draw();
});

/***********************************************************************
 * INITIALIZATION & DRAWING
 ***********************************************************************/
function initializeGaussians() {
gaussians = [];
const n = parseInt(numGaussiansSlider.value);
for (let i = 0; i < n; i++) {
    const meanX  = Math.random() * WIDTH;
    const meanY  = Math.random() * HEIGHT;
    const sigmaX = 5 + 25 * Math.random();  // random scale in [5..30]
    const sigmaY = 5 + 25 * Math.random();
    // random color & alpha
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    const alpha = 0.3 + 0.7 * Math.random(); // alpha in [0.3..1.0]

    gaussians.push({ meanX, meanY, sigmaX, sigmaY, r, g, b, alpha });
}
}

function draw() {
// Clear canvas
ctx.clearRect(0, 0, WIDTH, HEIGHT);

// Create image data for per-pixel rendering
const imgData = ctx.createImageData(WIDTH, HEIGHT);
const data = imgData.data; // [r, g, b, a,  r, g, b, a, ...]

// Scale multiplier
const scaleMult = parseFloat(scaleMultSlider.value);

// For each pixel, do front-to-back alpha blending
for (let py = 0; py < HEIGHT; py++) {
    for (let px = 0; px < WIDTH; px++) {
    const idx = 4 * (py * WIDTH + px);

    // We'll accumulate color in (accR, accG, accB, accA)
    let accR = 0;  // background color is white (255,255,255)
    let accG = 0;
    let accB = 0;
    let accA = 0;  // fully opaque background

    // if you want a transparent background, you can start with (0,0,0,0)

    // We'll treat each Gaussian as an "over" layer on top of the background
    // with color = (r, g, b), alpha = (coverage)
    for (const gauss of gaussians) {
        const dx = (px + 0.5) - gauss.meanX;
        const dy = (py + 0.5) - gauss.meanY;

        const sx = gauss.sigmaX * scaleMult;
        const sy = gauss.sigmaY * scaleMult;

        // Gaussian exponent for elliptical distribution (ignoring rotation):
        // exp(- (dx^2 / (2*sx^2) + dy^2 / (2*sy^2)))
        const exponent = (dx*dx)/(2*sx*sx) + (dy*dy)/(2*sy*sy);
        const gaussVal = Math.exp(-exponent);

        // coverage = alpha * gaussVal
        const src_a = gauss.alpha * gaussVal;   // [0..1]

        // "Over" alpha blending formula for front-to-back layering:
        // newColor = src_color*src_alpha + dst_color*dst_alpha*(1 - src_alpha)
        // newAlpha = src_alpha + dst_alpha*(1 - src_alpha)
        // But we have "background" in (accR,accG,accB) with alpha=accA
        // We'll convert background color from [0..255] to [0..1] to apply formula.
        const dst_r_f = accR / 255;
        const dst_g_f = accG / 255;
        const dst_b_f = accB / 255;
        const dst_a_f = accA;

        const src_r_f = gauss.r / 255;
        const src_g_f = gauss.g / 255;
        const src_b_f = gauss.b / 255;
        const src_a_f = src_a; // already in [0..1]

        const out_a_f = src_a_f + dst_a_f * (1 - src_a_f);
        if (out_a_f > 0.00001) {
        const out_r_f = (src_r_f * src_a_f + dst_r_f * dst_a_f * (1 - src_a_f)) / out_a_f;
        const out_g_f = (src_g_f * src_a_f + dst_g_f * dst_a_f * (1 - src_a_f)) / out_a_f;
        const out_b_f = (src_b_f * src_a_f + dst_b_f * dst_a_f * (1 - src_a_f)) / out_a_f;

        // Convert back to [0..255]
        accR += src_a * gauss.r / 2550;
        accG += src_a * gauss.g / 2550;
        accB += src_a * gauss.b / 2550;
        // accA = out_a_f;
        }
    }
    // console.log(accR, accB, accG)
    // Now store final color in image data
    data[idx + 0] = Math.round(accR * 255);
    data[idx + 1] = Math.round(accG * 255);
    data[idx + 2] = Math.round(accB * 255);
    data[idx + 3] = Math.round(1);
    }
}

// Put the computed image onto the canvas
ctx.putImageData(imgData, 0, 0);
}

// Initialize for the first time and draw
initializeGaussians();
draw();