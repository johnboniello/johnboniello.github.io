<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:atom="http://www.w3.org/2005/Atom">
<xsl:output method="html" encoding="UTF-8" indent="yes"/>

<xsl:template match="/rss/channel">
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title><xsl:value-of select="title"/></title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,600;1,400;1,500&amp;family=Archivo:wght@400;500;600;700&amp;display=swap"/>
  <link rel="stylesheet" href="/css/style.css"/>
</head>
<body>
  <main id="main">
    <section class="wrap section">
      <p class="hero__eyebrow">RSS Feed</p>
      <h1><xsl:value-of select="title"/></h1>
      <p class="hero__lede"><xsl:value-of select="description"/></p>

      <div class="card" style="margin: 1.5rem 0 2.5rem;">
        <h3>How to subscribe</h3>
        <p>This page is a feed, not a regular web page &#8212; you're seeing a plain version of it because
          your browser opened the link directly. To get new posts automatically, add this feed's URL
          to a feed reader (Feedly, Inoreader, NetNewsWire, and similar apps/services all work):</p>
        <p><code style="word-break: break-all;"><xsl:value-of select="atom:link/@href"/></code></p>
        <p>
          <a class="card__link" href="https://feedly.com/i/subscription/feed/{atom:link/@href}">Add to Feedly &#8594;</a>
        </p>
      </div>

      <h2>Latest writing</h2>
      <ul class="post-list">
        <xsl:for-each select="item">
          <li class="post-list__item">
            <a class="post-list__title" href="{link}"><xsl:value-of select="title"/></a>
            <span class="post-list__date"><xsl:value-of select="substring(pubDate, 6, 11)"/></span>
            <xsl:if test="description">
              <p class="post-list__summary"><xsl:value-of select="description"/></p>
            </xsl:if>
          </li>
        </xsl:for-each>
      </ul>
    </section>
  </main>
</body>
</html>
</xsl:template>

</xsl:stylesheet>
