---
layout: base.njk
title:
description: Practical tools and research summaries for teachers of students with disabilities and English Language Learners.
---
<section class="wrap hero">
  <p class="hero__eyebrow">Educator &middot; Researcher &middot; Builder</p>
  <h1>Tools that make school systems less painful.</h1>
  <p class="hero__lede">
    I am an educator focused on what actually works for students with disabilities and English
    Language Learners. The research and tools on this site come out of that work.
  </p>
</section>

<section class="wrap section writing-promo">
  <div class="section__heading-row">
    <h2>Latest writing</h2>
    <a href="/posts/">All posts &rarr;</a>
  </div>
  {% if collections.posts.length %}
  <div class="writing-grid">
    {%- for post in collections.posts | limit(3) %}
    <div class="writing-grid__item">
      <time class="writing-grid__date" datetime="{{ post.date | isoDate }}">{{ post.date | readableDate }}</time>
      <p class="writing-grid__title"><a href="{{ post.url }}">{{ post.data.title }}</a></p>
    </div>
    {%- endfor %}
  </div>
  {% else %}
  <p class="muted">New posts will show up here once they're published.</p>
  {% endif %}
</section>

<section class="wrap section" id="projects">
  <h2>Tools I have built</h2>
  <div class="card-grid">
    {%- for project in site.projects %}
    <div class="card{% if project.image %} card--media{% endif %}">
      {% if project.image %}<img class="card__image" src="{{ project.image }}" alt="{{ project.title }} screenshot">{% endif %}
      <h3>{{ project.title }}</h3>
      <p>{{ project.description }}</p>
      <a class="card__link" href="{{ project.url }}">{{ project.cta }} &rarr;</a>
    </div>
    {%- endfor %}
  </div>
</section>

<section class="wrap strip">
  <p class="muted">Photo essays and collections, kept separate from the rest.</p>
  <a href="/photography/">View the photos &rarr;</a>
</section>
