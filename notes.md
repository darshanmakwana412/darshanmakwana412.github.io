---
layout: page
title: Notes
order: 5
---

<div class="notes-list">
{% for note in site.notes %}
    <div class="note">
        {{note.title}}
    </div>
{% endfor %}
</div>