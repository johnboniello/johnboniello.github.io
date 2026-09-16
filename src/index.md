---
layout: base.njk
title:
description: Notes on what works in special education and English Language Learner instruction, and small tools I build, some for schools, some for my own family.
---
<section class="wrap hero">
  <p class="hero__eyebrow">Educator &middot; Researcher &middot; Builder</p>
  <h1>Research on schools, and tools I build along the way.</h1>
  <p class="hero__lede">
    I am a school administrator, researcher, and builder. I write about what actually works in
    special education and English Language Learner instruction, and I build small tools, some
    for the schools I work in and some for my own family.
  </p>
</section>

<section class="wrap section writing-promo">
  <div class="section__heading-row">
    <h2>Latest writing</h2>
    <a href="/writing/">All posts &rarr;</a>
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
  <p class="muted">A mix of tools I have built, for the schools I work in and for my own family.</p>
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
