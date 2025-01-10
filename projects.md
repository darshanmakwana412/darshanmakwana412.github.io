---
layout: page
title: Projects
order: 4
---

<style>
body {
    font-family: Arial, sans-serif;
    margin: 20px;
}

.project {
    display: flex;
    flex-direction: row;
    align-items: center;
    margin-bottom: 20px;
}

.project-image {
    max-width: 220px;
    max-height: 220px;
    margin-right: 20px;
}

.project-details {
    flex-grow: 1;
}

.project-title {
    font-size: 18px;
    font-weight: bold;
    margin-bottom: 5px;
}

.project-authors {
    font-size: 14px;
    color: #666;
    margin-bottom: 10px;
}

.project-links a {
    display: inline-block;
    margin-right: 10px;
    color: #007bff;
    text-decoration: none;
}
</style>

<div class="project">
<img class="project-image" src="./img/projects/toucan.gif" alt="Optimizing Toucan" width=400>
<div class="project-details">
    <div class="project-title">Minimal 2D Gaussian Splatting</div>
    <div class="project-authors">Implimentation of the original gaussian splatting paper for 2D images using tile based differential rasterization leveraging triton kernels</div>
    <div class="project-links">
    <a href="https://github.com/darshanmakwana412/mings">[Code]</a>
    </div>
</div>
</div>

<div class="project">
<img class="project-image" src="./img/projects/mvs.gif" alt="Bridge Optimization">
<div class="project-details">
    <div class="project-title">Multi View Reconstruction</div>
    <div class="project-authors">Reconstructing 3d objects from images by applying volumetric graph cut on visual hulls followed by ray casting for shading
</div>
    <div class="project-links">
    <a href="https://github.com/darshanmakwana412/Multi_View_Reconstruction/blob/main/report.pdf">[Report]</a>
    <a href="https://github.com/darshanmakwana412/Multi_View_Reconstruction">[Code]</a>
    </div>
</div>
</div>

<div class="project">
<img class="project-image" src="./img/projects/struct_optim.gif" alt="Bridge Optimization">
<div class="project-details">
    <div class="project-title">Struct Optim</div>
    <div class="project-authors">A gradient-based optimization framework that leverages efficient matrix formulation of the system to compute the optimal spatial configuration of a structure for a given set of loadings
</div>
    <div class="project-links">
    <a href="https://github.com/darshanmakwana412/structure_optimization/blob/main/main.pdf">[Paper]</a>
    <a href="https://github.com/darshanmakwana412/structure_optimization/tree/main">[Code]</a>
    </div>
</div>
</div>

<div class="project">
<img class="project-image" src="./img/projects/fractal.png" alt="Fractal Paths">
<div class="project-details">
    <div class="project-title">Fractal Curves for Tool Path Planning</div>
    <div class="project-authors">Using Fractal curves for tool path planning in layered 3d printing
</div>
    <div class="project-links">
    <a href="https://github.com/darshanmakwana412/fractal/blob/main/draft/tool_path_planning.pdf">[Paper]</a>
    <a href="https://github.com/darshanmakwana412/fractal">[Code]</a>
    </div>
</div>
</div>

<div class="project">
<img class="project-image" src="./img/projects/stable_vectors.png" alt="Stable Vectors">
<div class="project-details">
    <div class="project-title">Stable Vectors</div>
    <div class="project-authors">Generating stable vectors graphics using text conditional optimization
</div>
    <div class="project-links">
    <a href="https://github.com/darshanmakwana412/StableVectors?tab=readme-ov-file">[Code]</a>
    </div>
</div>
</div>