---
layout: page
title: Notes
order: 5
---

<div class="notes-list">
    <ul>
    {% for note in site.notes %}
        <li>
        <div class="note">
            <time datetime="{{ page.date | date_to_xmlschema }}" itemprop="datePublished">{{ note.date | date: "%b %-d, %Y" }}</time>: <a href="{{ note.url | prepend: site.baseurl }}">{{note.title}}</a>
        </div>
        </li>
    {% endfor %}
    </ul>
</div>