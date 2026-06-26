// TokUp Extension Background Service Worker
chrome.runtime.onInstalled.addListener(() => {
  console.log('TokUp · 脉充 extension installed');
});

// Detect AI tool pages and suggest TokUp
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    const url = tab.url || '';
    const isAiSite = /openai\.com|anthropic\.com|deepseek\.com/i.test(url);
    if (isAiSite) {
      chrome.action.setBadgeText({ text: 'TokUp', tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#10B981', tabId });
    } else {
      chrome.action.setBadgeText({ text: '', tabId });
    }
  }
});
