// ============================================================
// BROCOLI.FIT — NutriBot Chatbot (Gemini-powered)
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const toggle  = document.getElementById('chatToggle');
  const win     = document.getElementById('chatbotWin');
  const closeBtn= document.getElementById('chatClose');
  const input   = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSend');
  const msgs    = document.getElementById('chatMsgs');

  if (!toggle || !win) return;

  let isOpen    = false;
  let isTyping  = false;
  const profile = JSON.parse(localStorage.getItem('brocoliProfile') || '{}');
  const plan    = JSON.parse(localStorage.getItem('brocoliPlan') || '{}');

  // Toggle
  toggle.addEventListener('click', () => {
    isOpen = !isOpen;
    win.classList.toggle('open', isOpen);
    if (isOpen) { input?.focus(); toggle.querySelector('.chatbot-dot')?.remove(); }
  });

  closeBtn?.addEventListener('click', () => {
    isOpen = false;
    win.classList.remove('open');
  });

  // Send on button or Enter
  sendBtn?.addEventListener('click', sendMessage);
  input?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });

  async function sendMessage() {
    const text = input?.value?.trim();
    if (!text || isTyping) return;
    input.value = '';
    isTyping = true;

    appendMsg('user', text);
    const typingEl = appendTyping();

    try {
      const planSummary = plan?.analysis
        ? `Plan actif: ${plan.analysis.name}, ${plan.analysis.daily_calories} kcal/j, objectif: ${profile?.objectif || 'alimentation saine'}`
        : '';

      const prompt = window.GEMINI
        ? GEMINI.buildChatPrompt(text, profile, planSummary)
        : `Réponds brièvement en tant qu'assistant nutrition pédiatrique. Question: ${text}`;

      let response;
      if (window.GEMINI) {
        response = await GEMINI.call(prompt, false);
      } else {
        response = 'Je suis NutriBot. Configurez la clé API Gemini dans config.js pour activer l\'IA.';
      }

      typingEl.remove();
      appendMsg('bot', response);
    } catch(err) {
      typingEl.remove();
      appendMsg('bot', `Désolé, je rencontre un problème technique. Réessayez dans quelques instants. (${err.message})`);
    } finally {
      isTyping = false;
    }
  }

  function appendMsg(role, text) {
    if (!msgs) return;
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    div.innerHTML = role === 'bot'
      ? `<div class="chat-av">🥦</div><div class="chat-bubble">${escapeHtml(text).replace(/\n/g,'<br>')}</div>`
      : `<div class="chat-bubble">${escapeHtml(text)}</div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  function appendTyping() {
    if (!msgs) return document.createElement('div');
    const div = document.createElement('div');
    div.className = 'chat-msg bot';
    div.innerHTML = `<div class="chat-av">🥦</div><div class="chat-typing"><span></span><span></span><span></span></div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
});
