import test from 'node:test';
import assert from 'node:assert/strict';
import config from '../config/school.json' with { type: 'json' };
import { seed } from '../content/seed.ts';

test('fictional institution demo exposes bilingual published school content', () => {
  const data = seed('institution', config, true);
  for (const id of ['school-admissions', 'school-life', 'school-admin-info', 'school-projects', 'school-showcase']) {
    const content = data.content.find(item => item.id === id)?.published;
    assert.ok(content?.title.id && content.title.en && content.image, id);
  }
  assert.ok(data.institution.navigation.some(item => item.page === 'school-teachers'));
  assert.ok(data.content.filter(item => item.collection === 'announcements' && item.published?.attributes.kind === 'news').length >= 1);
  assert.ok(!seed('exam-prep', config, true).content.some(item => item.id === 'school-admissions'));
  assert.ok(seed('institution', config, false).institution.navigation.some(item => item.page === 'school-admissions'));
});

test('school directory and editorial fixtures support a complete browsing experience', () => {
  const data = seed('institution', config, true);
  assert.ok(data.tutors.length >= 16, 'A full junior-high directory needs more than a sample pair');
  const tutorIds = new Set(data.tutors.map(person => person.id));
  assert.equal(tutorIds.size, data.tutors.length);
  for (const session of data.sessions) assert.ok(tutorIds.has(session.tutorId), session.id);
  for (const person of data.tutors) assert.ok(person.bio.id && person.bio.en && person.specialty.id && person.specialty.en, person.id);
  const articles = data.content.filter(item => item.collection === 'announcements' && item.published?.attributes.kind === 'news');
  assert.ok(articles.length >= 6, 'News should offer a useful archive');
  for (const record of data.content.filter(item => item.collection === 'announcements' && item.published)) {
    assert.ok(record.published.blocks.length >= 2, `${record.id}: a published story needs an article beyond its teaser`);
  }
  const paragraphs = articles.flatMap(item => item.published.blocks.filter(block => block.type === 'text').map(block => block.body.id));
  assert.equal(new Set(paragraphs).size, paragraphs.length, 'Articles must not repeat generic filler paragraphs');
  assert.ok(data.content.filter(item => item.collection === 'announcements' && item.published?.attributes.kind === 'achievement').length >= 3);
  assert.ok(data.content.filter(item => item.collection === 'gallery' && item.published).length >= 8);
});
