// TokUp Browser Extension
const API = 'http://localhost:8000/api';

async function loadData() {
  try {
    const token = await chrome.storage.local.get('tokup_token');
    if (!token.tokup_token) {
      document.getElementById('balance').textContent = 'Login required';
      document.getElementById('keys-count').textContent = 'Click to login →';
      document.querySelector('.btn').textContent = 'Login to TokUp →';
      document.querySelector('.btn').href = 'http://localhost:3000/#/login';
      return;
    }

    const headers = { 'Authorization': `Bearer ${token.tokup_token}`, 'Content-Type': 'application/json' };

    // Fetch dashboard stats
    const res = await fetch(`${API}/dashboard/stats`, { headers });
    const data = await res.json();
    document.getElementById('balance').textContent = `¥${data.balance_yuan?.toFixed(2) || '0.00'}`;
    document.getElementById('today-usage').textContent = data.today_usage_yuan ? `¥${data.today_usage_yuan.toFixed(4)}` : '¥0';
    document.getElementById('keys-count').textContent = `${data.active_keys || 0} active keys`;
  } catch (err) {
    document.getElementById('balance').textContent = 'Offline';
    document.getElementById('keys-count').textContent = 'Could not connect';
  }
}

// Check auth on open
chrome.storage.local.get('tokup_token', (data) => {
  if (!data.tokup_token) {
    // Try to get from localStorage (if user is logged in on the main site)
    chrome.tabs.query({ url: 'http://localhost:3000/*' }, (tabs) => {
      if (tabs.length > 0) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => localStorage.getItem('tokup_token')
        }, (results) => {
          if (results && results[0] && results[0].result) {
            chrome.storage.local.set({ tokup_token: results[0].result });
          }
          loadData();
        });
      } else {
        loadData();
      }
    });
  } else {
    loadData();
  }
});
