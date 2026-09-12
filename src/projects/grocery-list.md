---
layout: base.njk
title: Grocery List
description: A shared household grocery list with diet-restriction highlighting.
---
<section class="wrap section prose">

# Grocery List App

This one is for my own house. My wife and I always find it difficult to find time to sit down and create a grocery shopping list, and are juggling potentially a few different diet restrictions at the same time. Every shared grocery list app we tried made us stop and think, "wait, can we all actually eat this?" So I worked with Claude Code to build one that just tells us. Now we can add food to our shared list any time and we know if it meets the restrictions or not. 

You pick your household's diet restrictions (dairy-free, gluten-free, vegan, low-carb, or modified AIP) and every item on the list gets color coded green or red based on whether it fits. No more guessing in the store. You can also add a food from the catalog search function and edit any dietary restriction tags on any food.

## How to use the application

There are two ways to use this application: open it in the browser or install the Android app. Both talk to the same backend, so a household created on one works fine on the other.

- [Open the web app](/grocery/)
- [Download the Android APK](https://github.com/johnboniello/Grocery-list-app/releases/latest/download/app-release.apk)

### How it works

- **This Week** is your active list, check items off as you shop.
- **High Frequency** and **Less Frequent** are your standing lists of stuff you buy often or occasionally, tap to add something to this week.
- **Catalog** is the full item library (over 200 items to start) that you search and add from, and you can tag your own custom items with diet restrictions too.
- No accounts or email required. One person creates a household, generates a one-time invite code, and the other person joins with it. That is the whole setup.

### Installing the APK

This is only available for Android right now. When you download it, you will need to change your settings to allow installing apps from outside the Play Store. Once it downloads and you tap install, you will likely see a Play Protect warning since this is not a Play Store app, tap "Advanced" and then "Install anyway."

Contact me if you get stuck.

- [Open the web app](/grocery/)
- [Source on GitHub](https://github.com/johnboniello/Grocery-list-app)
- [Download the Android APK](https://github.com/johnboniello/Grocery-list-app/releases/latest/download/app-release.apk)

</section>
