document.addEventListener('DOMContentLoaded', () => {
    const ipInput = document.getElementById('ipInput');
    const ipCount = document.getElementById('ipCount');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const clearBtn = document.getElementById('clearBtn');
    const copyBtn = document.getElementById('copyBtn');
    const resultsList = document.getElementById('resultsList');
    const statusInfo = document.getElementById('statusInfo');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    // Update IP count on input
    ipInput.addEventListener('input', () => {
        const ips = getCleanInputs();
        ipCount.textContent = `${ips.length} 個項目`;
    });

    clearBtn.addEventListener('click', () => {
        ipInput.value = '';
        ipCount.textContent = '0 個項目';
        resultsList.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" width="48" height="48" opacity="0.3"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.59-12.42L10 14.17l-2.59-2.58L6 13l4 4 8-8z"/></svg>
                <p>等待輸入並執行查詢...</p>
            </div>`;
        statusInfo.classList.add('hidden');
    });

    copyBtn.addEventListener('click', () => {
        const items = resultsList.querySelectorAll('.result-item');
        if (items.length === 0) return;

        let text = '';
        items.forEach(item => {
            const ip = item.querySelector('.result-ip').textContent;
            const country = item.querySelector('.result-country').textContent;
            text += `${ip}\t${country}\n`;
        });

        navigator.clipboard.writeText(text).then(() => {
            const originalText = copyBtn.innerHTML;
            copyBtn.textContent = '已複製！';
            setTimeout(() => copyBtn.innerHTML = originalText, 2000);
        });
    });

    analyzeBtn.addEventListener('click', async () => {
        const rawInputs = getCleanInputs();
        if (rawInputs.length === 0) {
            alert('請輸入至少一個 IP 地址或區段');
            return;
        }

        // UI State
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = '查詢中...';
        resultsList.innerHTML = '';
        statusInfo.classList.remove('hidden');
        progressFill.style.width = '0%';
        progressText.textContent = '準備中...';

        try {
            const batchSize = 50;
            for (let i = 0; i < rawInputs.length; i += batchSize) {
                const batch = rawInputs.slice(i, i + batchSize);
                
                // Prepare query batch: extract base IP if it's CIDR
                const queryBatch = batch.map(input => {
                    return input.includes('/') ? input.split('/')[0] : input;
                });

                const progress = Math.round((i / rawInputs.length) * 100);
                progressText.textContent = `處理中: ${progress}%`;
                progressFill.style.width = `${progress}%`;

                const apiResults = await fetchIpData(queryBatch);
                
                // Merge original input back for display
                const mergedResults = apiResults.map((res, idx) => ({
                    ...res,
                    displayQuery: batch[idx] // Show original input (e.g. 1.1.1.0/24)
                }));

                renderResults(mergedResults);
            }

            progressText.textContent = '查詢完成';
            progressFill.style.width = '100%';
        } catch (error) {
            console.error(error);
            alert('查詢發生錯誤，請稍後再試。');
        } finally {
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = '開始查詢';
        }
    });

    function getCleanInputs() {
        return ipInput.value.split('\n')
            .map(line => line.trim())
            // Support IPv4, IPv6, and CIDR (/)
            .filter(line => line.length > 0 && /^[0-9a-fA-F.:/]+$/.test(line));
    }

    async function fetchIpData(ips) {
        // We use 'en' for language to ensure we get standard fields,
        // and then we'll localize the country code ourselves.
        const response = await fetch('http://ip-api.com/batch?lang=en', {
            method: 'POST',
            body: JSON.stringify(ips)
        });

        if (!response.ok) throw new Error('API Error');
        return await response.json();
    }

    const regionNames = new Intl.DisplayNames(['zh-Hant-TW'], { type: 'region' });

    function renderResults(results) {
        results.forEach((res, index) => {
            const item = document.createElement('div');
            item.className = 'result-item';
            item.style.animationDelay = `${index * 0.05}s`;

            if (res.status === 'success') {
                let countryName = res.country; // Fallback
                try {
                    // Try to get Traditional Chinese name from countryCode
                    if (res.countryCode) {
                        countryName = regionNames.of(res.countryCode);
                    }
                } catch (e) {
                    console.warn('Localization error for:', res.countryCode);
                }

                item.innerHTML = `
                    <span class="result-ip">${res.displayQuery}</span>
                    <span class="result-country">${countryName}</span>
                `;
            } else {
                item.innerHTML = `
                    <span class="result-ip">${res.displayQuery || '未知 IP'}</span>
                    <span class="result-country result-error">查詢失敗 (${res.message || '格式錯誤'})</span>
                `;
            }
            resultsList.appendChild(item);
        });
        
        // Auto scroll to bottom
        resultsList.scrollTop = resultsList.scrollHeight;
    }
});
