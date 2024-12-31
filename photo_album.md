---
layout: page
title: "Photos"
nav_exclude: true
---

<div style="display: flex; flex-wrap: wrap; gap: 1rem;">
{% assign random_images = site.static_files | where_exp: "file", "file.path contains 'img/random'" %}

{% for image in random_images %}
  <div>
    <img 
      src="{{ image.path | relative_url }}"
      alt="{{ image.name }}" 
      style="max-width: 300px;"
    >
    <p>{{ image.name }}</p>
  </div>
{% endfor %}
</div>