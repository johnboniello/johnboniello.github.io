---
layout: base.njk
title: Photography
permalink: /photography/
description: A few photo collections.
---
<section class="wrap section">
  <h1>Photography</h1>
  {% set collectionsList = collections.photocollection | reverse %}
  {% if collectionsList.length %}
  <div class="card-grid">
    {%- for c in collectionsList %}
    <a class="card photo-cover-card" href="{{ c.url }}">
      <img class="photo-cover-card__img" src="/images/photography/{{ c.data.cover }}" alt="">
      <h3>{{ c.data.title }}</h3>
      {% if c.data.description %}<p>{{ c.data.description }}</p>{% endif %}
    </a>
    {%- endfor %}
  </div>
  {% else %}
  <p class="muted">New collections will show up here once they're published.</p>
  {% endif %}
</section>
