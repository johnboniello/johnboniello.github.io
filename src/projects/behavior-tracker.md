---
layout: base.njk
title: Behavior Referral Tracker
description: A free, role-based behavior referral system for K-12 schools.
---
<section class="wrap section prose">

# Behavior Referral Tracker

This is a free, role-based behavior referral and case-management system for K-12 schools. It started as a spreadsheet-and-forms tool for tracking referrals in my own district, and I've since rebuilt it from the ground up into a proper multi-user web app: teachers submit referrals in a couple of clicks, building admins assign them to counselors, and everyone gets closed-loop email updates instead of a referral disappearing into a spreadsheet no one revisits.

It runs entirely inside your district's own Google Workspace: no new vendor, no hosting cost, and no student demographic data ever stored in it. A district admin can optionally join in a separate SIS export live, at report time, for equity reporting, and nothing from it is saved afterward.

## What it does

1. **Role-based access** - teachers, counselors, building admins, and a district admin each see only what they should, enforced by the app itself rather than by sharing permissions on a spreadsheet.

2. **A full referral workflow** - submit, assign, and close cases, with email notifications at each step so nothing gets dropped.

3. **An Analytics tab** - filterable charts by location, period/activity, time of day, day of week, grade, and referral type, so patterns (where, when, and during what) are actually visible instead of buried in rows.

4. **Privacy by design** - no demographic data is ever stored in the tool.

5. **Free and self-hosted** - it runs as a Google Apps Script project inside your own district's Google account. There's no central server, no subscription, and your student data never leaves your own Workspace.

## Deploying it

This is a template you deploy for your own district, not a shared hosted service — each district runs its own private copy inside its own Google account, so your data is never shared with mine or with any other district's. Deployment takes about 15 minutes and doesn't require coding experience; you're mostly pasting files into the Apps Script editor and following the README.

- [Source and setup guide on GitHub](https://github.com/johnboniello/Behavior-Tracker/tree/master/V%202.0%20major%20rebuild)
- [Setup guide (README)](https://github.com/johnboniello/Behavior-Tracker/blob/master/V%202.0%20major%20rebuild/README.md)

Contact me if you need help.

</section>
