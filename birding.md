---
layout: page
title: Birding
order: 7
---

<style>
  figcaption {
    text-align: center;
    font-size: 1rem;
  }

  .name {
    font-weight: bold;
  }
</style>

<table>
  {% for image in site.data.birding.images %}
  {% assign filename = image.name | append: ".png" %}
  {% assign caption = image.name | replace: "_", " " | capitalize %}
  {% assign scientific_name = image.scientific_name %}
  <tr>
    <td>
      <figure>
        <img src="{{ site.url }}/img/birding/{{ filename }}" alt="{{ caption }}">
        <figcaption>
          <span class="name"><em>{{ caption }}</em></span>
          (<span class="scientific-name"><em>{{ scientific_name }}</em></span>)
        </figcaption>
      </figure>
    </td>
    {% cycle "", "</tr><tr>" %}
  </tr>
  {% endfor %}
</table>

<!-- ---
layout: page
title: Birding
order: 7
---

<style>
  figcaption {
    text-align: center;
  }
</style>

<table>
  <tr>
    <td>
      <figure>
        <img src="{{ site.url }}/img/birding/golden_eagle.png" alt="Golden Eagle" />
        <figcaption>Golden Eagle</figcaption>
      </figure>
    </td>
    <td>
      <figure>
        <img src="{{ site.url }}/img/birding/grumpy_babbler.png" alt="Grumpy Babbler" />
        <figcaption>Grumpy Babbler</figcaption>
      </figure>
    </td>
  </tr>

  <tr>
    <td>
      <figure>
        <img src="{{ site.url }}/img/birding/kingfisher.png" alt="Kingfisher" />
        <figcaption>Kingfisher</figcaption>
      </figure>
    </td>
    <td>
      <figure>
        <img src="{{ site.url }}/img/birding/dragonfly.png" alt="Dragonfly" />
        <figcaption>Dragonfly</figcaption>
      </figure>
    </td>
  </tr>

  <tr>
    <td>
      <figure>
        <img src="{{ site.url }}/img/birding/black_kite.png" alt="Black Kite" />
        <figcaption>Black Kite</figcaption>
      </figure>
    </td>
    <td>
      <figure>
        <img src="{{ site.url }}/img/birding/crow.png" alt="Crow" />
        <figcaption>Crow</figcaption>
      </figure>
    </td>
  </tr>

  <tr>
    <td>
      <figure>
        <img src="{{ site.url }}/img/birding/hornbill.png" alt="Hornbill" />
        <figcaption>Hornbill</figcaption>
      </figure>
    </td>
    <td>
      <figure>
        <img src="{{ site.url }}/img/birding/koel.png" alt="Koel" />
        <figcaption>Koel</figcaption>
      </figure>
    </td>
  </tr>

  <tr>
    <td>
      <figure>
        <img src="{{ site.url }}/img/birding/magpie.png" alt="Magpie" />
        <figcaption>Magpie</figcaption>
      </figure>
    </td>
    <td>
      <figure>
        <img src="{{ site.url }}/img/birding/mayna.png" alt="Mayna" />
        <figcaption>Mayna</figcaption>
      </figure>
    </td>
  </tr>

  <tr>
    <td>
      <figure>
        <img src="{{ site.url }}/img/birding/asian_bee_eater.png" alt="Asian Bee Eater" />
        <figcaption>Asian Bee Eater</figcaption>
      </figure>
    </td>
    <td>
      <figure>
        <img src="{{ site.url }}/img/birding/oriental_magpie_robin.png" alt="Oriental Magpie Robin" />
        <figcaption>Oriental Magpie Robin</figcaption>
      </figure>
    </td>
  </tr>
</table> -->

<!-- ---
layout: page
title: Birding
order: 7
---

<img src="{{ site.url }}/img/birding/golden_eagle.png" />

<img src="{{ site.url }}/img/birding/grumpy_babbler.png" />

<img src="{{ site.url }}/img/birding/kingfisher.png" />

<img src="{{ site.url }}/img/birding/dragonfly.png" />

<img src="{{ site.url }}/img/birding/magpie.png" />

<img src="{{ site.url }}/img/birding/hornbill.png" />

<img src="{{ site.url }}/img/birding/black_kite.png" />

<img src="{{ site.url }}/img/birding/crow.png" />

<img src="{{ site.url }}/img/birding/koel.png" /> -->