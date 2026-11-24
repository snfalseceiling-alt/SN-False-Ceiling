import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHATBOT_ROLES,
  buildGeminiHistory,
  resolveChatbotRole,
} from './aiChat';

test('resolveChatbotRole maps general roles to gemini-4-hydrogen and quick lookup to gemini-3.1-flash-lite', () => {
  assert.equal(resolveChatbotRole('material_advisor').model, 'gemini-4-hydrogen');
  assert.equal(resolveChatbotRole('boq_planner').model, 'gemini-4-hydrogen');
  assert.equal(resolveChatbotRole('platform_support').model, 'gemini-4-hydrogen');
  assert.equal(resolveChatbotRole('quick_lookup').model, 'gemini-3.1-flash-lite');
  assert.equal(resolveChatbotRole('unknown_role').id, 'material_advisor');
});

test('all chatbot roles define non-empty system instructions and starter prompts', () => {
  for (const role of Object.values(CHATBOT_ROLES)) {
    assert.ok(role.systemInstruction.length > 40);
    assert.ok(role.starterPrompts.length >= 2);
  }
});

test('buildGeminiHistory strips leading assistant greetings and error messages', () => {
  const history = buildGeminiHistory([
    { role: 'assistant', text: 'Welcome to BuildMate!' },
    { role: 'user', text: 'What wire for 1.5 ton AC?' },
    { role: 'assistant', text: 'Use 4.0 sq.mm copper wire with a 20A/25A MCB.' },
    { role: 'assistant', text: 'Network error', isError: true },
    { role: 'user', text: 'What about lighting circuits?' },
  ]);

  assert.equal(history.length, 3);
  assert.equal(history[0].role, 'user');
  assert.equal(history[0].parts[0].text, 'What wire for 1.5 ton AC?');
  assert.equal(history[1].role, 'model');
  assert.equal(history[2].role, 'user');
  assert.equal(history[2].parts[0].text, 'What about lighting circuits?');
});
