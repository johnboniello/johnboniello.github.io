---
layout: base.njk
title: Research Roundup
permalink: /research-roundup/
description: Semi-regular summaries of education research and reading, not always peer-reviewed, always aimed at what actually helps in the classroom.
---
<section class="wrap section">
  <h1>Research Roundup</h1>
  <p class="hero__lede">
    Semi-regular summaries of education research and reading I've found useful — not always
    peer-reviewed, always aimed at what actually helps in the classroom.
  </p>
  {% set roundups = collections.roundup | reverse %}
  {% if roundups.length %}
  <ul class="post-list">
    {%- for post in roundups %}
    <li class="post-list__item">
      <a class="post-list__title" href="{{ post.url }}">{{ post.data.title }}</a>
      <time class="post-list__date" datetime="{{ post.date | isoDate }}">{{ post.date | readableDate }}</time>
      {% if post.data.summary %}<p class="post-list__summary">{{ post.data.summary }}</p>{% endif %}
    </li>
    {%- endfor %}
  </ul>
  {% else %}
  <p class="muted">New roundups will show up here once they're published.</p>
  {% endif %}
</section>
