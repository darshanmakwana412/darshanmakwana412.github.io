---
layout: page
permalink: /running/
title: Running
---

{%- comment -%} Runs live in _data/runs.yml; the totals below are computed from it. {%- endcomment -%}
{%- assign runs = site.data.runs | sort: "date" | reverse -%}
{%- assign total_km = 0 -%}
{%- assign total_sec = 0 -%}
{%- assign longest = runs.first -%}
{%- for run in runs -%}
  {%- assign total_km = total_km | plus: run.km -%}
  {%- assign parts = run.time | split: ":" -%}
  {%- assign sec = parts[0] | times: 60 | plus: parts[1] -%}
  {%- assign total_sec = total_sec | plus: sec -%}
  {%- assign km = run.km | plus: 0 -%}
  {%- assign longest_km = longest.km | plus: 0 -%}
  {%- if km > longest_km -%}{%- assign longest = run -%}{%- endif -%}
{%- endfor -%}
{%- assign hours = total_sec | divided_by: 3600 -%}
{%- assign minutes = total_sec | modulo: 3600 | divided_by: 60 %}

<div class="run-stats">
  <div><b>{{ runs.size }}</b><span>runs</span></div>
  <div><b>{{ total_km | round: 1 }}</b><span>km total</span></div>
  <div><b>{{ hours }}h {{ minutes }}m</b><span>on feet</span></div>
  <div><b>{{ longest.km }}</b><span>longest km</span></div>
</div>

<table class="run-log">
  <thead>
    <tr><th>Date</th><th>Distance</th><th>Time</th><th>Pace</th></tr>
  </thead>
  <tbody>
    {%- for run in runs %}
    <tr>
      <td>{{ run.date | date: "%b %-d, %Y" }}</td>
      <td>{{ run.km }} km</td>
      <td>{{ run.time }}</td>
      <td>{{ run.pace }} /km</td>
    </tr>
    {%- endfor %}
  </tbody>
</table>
