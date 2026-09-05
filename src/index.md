---
layout: base.njk
title:
description: Practical tools, research summaries, and consulting for teachers of students with disabilities and English Language Learners.
---
<section class="wrap hero">
  <p class="hero__eyebrow">{{ site.tagline }}</p>
  <h1>Hi, I'm {{ site.author }}.</h1>
  <p class="hero__lede">
    I'm an educator, and I like to dig into what actually works — especially for students with
    disabilities and English Language Learners. This site is where I post research summaries,
    occasional writeups, and the tools I've built for teachers and administrators along the way.
  </p>
  <p class="hero__lede">
    I'm also building out <a href="/consulting/">special education consulting</a> services — more
    on that soon.
  </p>
</section>

<section class="wrap section" id="projects">
  <h2>Projects</h2>
  <div class="card-grid">
    {%- for project in site.projects %}
    <div class="card">
      <h3>{{ project.title }}</h3>
      <p>{{ project.description }}</p>
      <a class="card__link" href="{{ project.url }}">{{ project.cta }} &rarr;</a>
    </div>
    {%- endfor %}
  </div>
</section>

<section class="wrap section">
  <div class="section__heading-row">
    <h2>Latest posts</h2>
    <a href="/posts/">All posts &rarr;</a>
  </div>
  {% if collections.posts.length %}
  <ul class="post-list">
    {%- for post in collections.posts | limit(3) %}
    <li class="post-list__item">
      <a class="post-list__title" href="{{ post.url }}">{{ post.data.title }}</a>
      <time class="post-list__date" datetime="{{ post.date | isoDate }}">{{ post.date | readableDate }}</time>
      {% if post.data.summary %}<p class="post-list__summary">{{ post.data.summary }}</p>{% endif %}
    </li>
    {%- endfor %}
  </ul>
  {% else %}
  <p class="muted">New posts will show up here once they're published.</p>
  {% endif %}
</section>
