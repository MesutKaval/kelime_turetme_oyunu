// ===== GAME STATE =====
const gameState = {
    // Common state
    letters: [],
    validWords: [],
    foundWords: [],
    score: 0,
    timeLeft: 100,
    timerInterval: null,
    isPlaying: false,
    wordDictionary: [],
    longestWordLength: 0,
    longestWordsFound: [],

    // Multiplayer state
    gameMode: 'single', // 'single' or 'multiplayer'
    players: [], // Array of {name, score, turnsPlayed}
    currentPlayerIndex: 0,
    currentRound: 1,
    totalRounds: 3,
    turnTimeLeft: 5,
    timerPaused: false,
    turnsPerRound: 5,

    // UI state
    restartButtonAction: 'restart' // 'restart', 'showRoundSummary', or 'continueRound'
};

// ===== TURKISH LETTER FREQUENCIES =====
const letterFrequencies = {
    'a': 11.92, 'e': 8.91, 'i': 8.60, 'n': 7.48, 'r': 6.95,
    'l': 5.75, 't': 5.54, 'k': 4.68, 's': 4.59, 'u': 4.34,
    'm': 3.75, 'd': 3.74, 'o': 3.51, 'y': 3.49, 'b': 2.85,
    'ı': 2.77, 'z': 2.75, 'v': 2.25, 'g': 2.18, 'h': 1.85,
    'p': 1.64, 'ş': 1.58, 'c': 1.45, 'ç': 1.13, 'f': 0.84,
    'ö': 0.78, 'ü': 0.69, 'ğ': 0.68, 'j': 0.25
};

// Turkish vowels and consonants
const vowels = ['a', 'e', 'ı', 'i', 'o', 'ö', 'u', 'ü'];
const consonants = ['b', 'c', 'ç', 'd', 'f', 'g', 'ğ', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'r', 's', 'ş', 't', 'v', 'y', 'z'];

// ===== AUDIO CONTEXT FOR SOUND EFFECTS =====
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playSound(frequency, duration, type = 'sine') {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

function playCorrectSound() {
    playSound(800, 0.15);
    setTimeout(() => playSound(1000, 0.1), 100);
}

function playWrongSound() {
    playSound(200, 0.3, 'sawtooth');
}

function playDuplicateSound() {
    // Different sound for duplicate words - double beep
    playSound(400, 0.15, 'square');
    setTimeout(() => playSound(400, 0.15, 'square'), 150);
}

function playTickSound() {
    playSound(440, 0.05);
}

function playEndSound() {
    playSound(600, 0.2);
    setTimeout(() => playSound(500, 0.2), 200);
    setTimeout(() => playSound(400, 0.3), 400);
}

function playApplauseSound() {
    // Play cheering.wav for longest word bonus
    const audio = new Audio('cheering.wav');
    audio.volume = 0.5;
    audio.play().catch(err => console.log('Ses çalınamadı:', err));
}

// ===== DOM ELEMENTS =====
const elements = {
    // Start screens
    startScreen: document.getElementById('startScreen'),
    btnSinglePlayer: document.getElementById('btnSinglePlayer'),
    btnMultiplayer: document.getElementById('btnMultiplayer'),
    playerSetupScreen: document.getElementById('playerSetupScreen'),
    playerInputsContainer: document.getElementById('playerInputsContainer'),
    btnAddPlayer: document.getElementById('btnAddPlayer'),
    roundSelector: document.getElementById('roundSelector'),
    btnBackToMode: document.getElementById('btnBackToMode'),
    btnStartMultiplayer: document.getElementById('btnStartMultiplayer'),

    // Game area
    lettersSection: document.getElementById('lettersSection'),
    lettersContainer: document.getElementById('lettersContainer'),
    inputSection: document.getElementById('inputSection'),
    wordInput: document.getElementById('wordInput'),
    foundWordsSection: document.getElementById('foundWordsSection'),
    foundWordsContainer: document.getElementById('foundWordsContainer'),
    foundCount: document.getElementById('foundCount'),
    timer: document.getElementById('timer'),
    score: document.getElementById('score'),
    btnMainMenu: document.getElementById('btnMainMenu'),

    // Multiplayer
    playerPanelsContainer: document.getElementById('playerPanelsContainer'),
    roundSummaryModal: document.getElementById('roundSummaryModal'),
    roundSummaryTitle: document.getElementById('roundSummaryTitle'),
    scoresTable: document.getElementById('scoresTable'),
    btnContinueRound: document.getElementById('btnContinueRound'),

    // Modals
    endGameModal: document.getElementById('endGameModal'),
    finalScore: document.getElementById('finalScore'),
    btnRestart: document.getElementById('btnRestart'),
    definitionModal: document.getElementById('definitionModal'),
    definitionWord: document.getElementById('definitionWord'),
    definitionBody: document.getElementById('definitionBody'),
    btnCloseDefinition: document.getElementById('btnCloseDefinition')
};

// ===== NORMALIZE WORD (Remove circumflex accents) =====
function normalizeWord(word) {
    return word
        .replace(/â/g, 'a')
        .replace(/Â/g, 'A')
        .replace(/î/g, 'i')
        .replace(/Î/g, 'I')
        .replace(/û/g, 'u')
        .replace(/Û/g, 'U');
}

// ===== INITIALIZATION =====
async function loadDictionary() {
    try {
        const response = await fetch('turkce_kelime_listesi.txt');
        const text = await response.text();
        gameState.wordDictionary = text.split('\n')
            .map(word => normalizeWord(word.trim().toLocaleLowerCase('tr-TR'))) // Normalize circumflex
            .filter(word => word.length >= 4); // Minimum 4 letters
        console.log(`Sözlük yüklendi: ${gameState.wordDictionary.length} kelime`);
    } catch (error) {
        console.error('Sözlük yüklenemedi:', error);
        // Fallback: demo words
        gameState.wordDictionary = ['test', 'kelime', 'oyun', 'deneme'];
    }
}

// ===== WEIGHTED RANDOM SELECTION =====
function weightedRandomSelection(items, weights, count) {
    const selected = [];
    const letterCounts = {}; // Track how many times each letter is selected

    for (let i = 0; i < count; i++) {
        if (items.length === 0) break;

        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        let random = Math.random() * totalWeight;

        let selectedIndex = 0;
        let attempts = 0;
        const maxAttempts = 100; // Prevent infinite loop

        // Keep trying until we find a letter that hasn't been used twice
        while (attempts < maxAttempts) {
            random = Math.random() * totalWeight;
            selectedIndex = 0;

            for (let j = 0; j < weights.length; j++) {
                random -= weights[j];
                if (random <= 0) {
                    selectedIndex = j;
                    break;
                }
            }

            const selectedLetter = items[selectedIndex];

            // Check if this letter has been used less than 2 times
            if (!letterCounts[selectedLetter] || letterCounts[selectedLetter] < 2) {
                selected.push(selectedLetter);
                letterCounts[selectedLetter] = (letterCounts[selectedLetter] || 0) + 1;
                break;
            }

            attempts++;
        }

        // If we couldn't find a valid letter after max attempts, just add any letter
        if (attempts >= maxAttempts) {
            selected.push(items[selectedIndex]);
        }
    }

    return selected;
}

function generateLetters() {
    // Separate vowels and consonants with their frequencies
    const vowelFreqs = vowels.map(v => letterFrequencies[v] || 1);
    const consonantFreqs = consonants.map(c => letterFrequencies[c] || 1);

    // Select 4 vowels and 6 consonants
    const selectedVowels = weightedRandomSelection(vowels, vowelFreqs, 4);
    const selectedConsonants = weightedRandomSelection(consonants, consonantFreqs, 6);

    // Combine and shuffle
    const allLetters = [...selectedVowels, ...selectedConsonants];
    return allLetters.sort(() => Math.random() - 0.5);
}

// ===== WORD VALIDATION =====
function canFormWord(word, availableLetters) {
    const letterCount = {};

    // Count available letters
    for (const letter of availableLetters) {
        letterCount[letter] = (letterCount[letter] || 0) + 1;
    }

    // Check if word can be formed
    for (const letter of word) {
        if (!letterCount[letter] || letterCount[letter] === 0) {
            return false;
        }
        letterCount[letter]--;
    }

    return true;
}

function findValidWords(letters) {
    return gameState.wordDictionary.filter(word =>
        word.length >= 4 && canFormWord(word, letters)
    );
}

// ===== GAME LOGIC =====
function startGame() {
    // Reset game state
    gameState.letters = generateLetters();
    gameState.foundWords = [];
    gameState.score = 0;
    gameState.timeLeft = 100;
    gameState.isPlaying = true;

    // Find all valid words (solver algorithm)
    gameState.validWords = findValidWords(gameState.letters);
    console.log(`Geçerli kelimeler (${gameState.validWords.length}):`, gameState.validWords);

    // Find longest word length for bonus detection
    gameState.longestWordLength = Math.max(...gameState.validWords.map(w => w.length));
    gameState.longestWordsFound = [];
    console.log(`En uzun kelime uzunluğu: ${gameState.longestWordLength} harf`);

    // Update UI
    elements.startScreen.style.display = 'none';
    elements.lettersSection.style.display = 'block';
    elements.inputSection.style.display = 'block';
    elements.foundWordsSection.style.display = 'block';

    // Display letters
    elements.lettersContainer.innerHTML = '';
    gameState.letters.forEach(letter => {
        const card = document.createElement('div');
        card.className = 'letter-card';
        card.textContent = letter.toLocaleUpperCase('tr-TR');
        elements.lettersContainer.appendChild(card);
    });

    // Reset found words display
    elements.foundWordsContainer.innerHTML = '<p class="empty-message">Henüz kelime bulunamadı...</p>';
    elements.foundCount.textContent = '0';

    // Enable input
    elements.wordInput.disabled = false;
    elements.wordInput.value = '';
    elements.wordInput.focus();

    // Update score and timer
    updateScore(0);
    updateTimer();

    // Start timer
    gameState.timerInterval = setInterval(updateTimer, 1000);
}

function updateTimer() {
    elements.timer.textContent = gameState.timeLeft;

    // Warning animation in last 10 seconds
    if (gameState.timeLeft <= 10) {
        elements.timer.classList.add('warning');
        playTickSound();
    } else {
        elements.timer.classList.remove('warning');
    }

    if (gameState.timeLeft <= 0) {
        endGame();
        return;
    }

    gameState.timeLeft--;
}

function updateScore(points) {
    gameState.score += points;
    elements.score.textContent = gameState.score;
}

function submitWord() {
    if (!gameState.isPlaying) return;

    const rawInput = elements.wordInput.value.trim().toLocaleLowerCase('tr-TR');
    const input = normalizeWord(rawInput); // Normalize circumflex characters

    if (!input) return;

    // Check if word is valid
    if (!gameState.validWords.includes(input)) {
        // Wrong word
        playWrongSound();
        elements.wordInput.classList.add('shake');
        setTimeout(() => elements.wordInput.classList.remove('shake'), 500);
        elements.wordInput.value = '';
        return;
    }

    // Check if already found
    if (gameState.foundWords.includes(input)) {
        playDuplicateSound();
        elements.wordInput.classList.add('shake');
        setTimeout(() => elements.wordInput.classList.remove('shake'), 500);

        // Flash the existing word in the found words list
        const wordTags = elements.foundWordsContainer.querySelectorAll('.word-tag');
        wordTags.forEach(tag => {
            if (tag.textContent === input) {
                tag.classList.add('flash-duplicate');
                setTimeout(() => tag.classList.remove('flash-duplicate'), 1000);
            }
        });

        elements.wordInput.value = '';
        return;
    }

    // Correct word!
    gameState.foundWords.push(input);

    // Check if this is a longest word (bonus!)
    const isLongestWord = input.length === gameState.longestWordLength;
    let points = input.length * 10;

    if (isLongestWord && !gameState.longestWordsFound.includes(input)) {
        // BONUS: 2x points for longest word!
        points = points * 2;
        gameState.longestWordsFound.push(input);
        playApplauseSound();

        // Visual feedback for bonus
        console.log(`🎉 BONUS! En uzun kelime bulundu: "${input}" (${input.length} harf) - 2x Puan!`);
    } else {
        playCorrectSound();
    }

    updateScore(points);

    // Update found words display
    if (gameState.foundWords.length === 1) {
        elements.foundWordsContainer.innerHTML = '';
    }

    const wordTag = document.createElement('div');
    wordTag.className = 'word-tag';
    wordTag.textContent = input;
    elements.foundWordsContainer.appendChild(wordTag);

    elements.foundCount.textContent = gameState.foundWords.length;

    // Clear input
    elements.wordInput.value = '';
}

function endGame() {
    gameState.isPlaying = false;
    clearInterval(gameState.timerInterval);

    // Disable input
    elements.wordInput.disabled = true;

    // Play end sound
    playEndSound();

    // Calculate statistics
    const totalWords = gameState.validWords.length;
    const foundCount = gameState.foundWords.length;
    const missedCount = totalWords - foundCount;
    const successPercentage = totalWords > 0 ? Math.round((foundCount / totalWords) * 100) : 0;

    // Update modal header
    elements.finalScore.textContent = gameState.score;

    // Update statistics
    document.getElementById('statsFound').textContent = foundCount;
    document.getElementById('statsMissed').textContent = missedCount;
    document.getElementById('statsTotal').textContent = totalWords;
    document.getElementById('statsPercentage').textContent = successPercentage + '%';

    // Group words by length
    const wordsByLength = {};
    gameState.validWords.forEach(word => {
        const len = word.length;
        if (!wordsByLength[len]) {
            wordsByLength[len] = [];
        }
        wordsByLength[len].push(word);
    });

    // Sort words alphabetically within each length group
    Object.keys(wordsByLength).forEach(len => {
        wordsByLength[len].sort((a, b) => a.localeCompare(b, 'tr-TR'));
    });

    // Create columns for each word length
    const wordsGrid = document.getElementById('wordsGrid');
    wordsGrid.innerHTML = '';

    // Get sorted length keys (4, 5, 6, 7, ...)
    const lengths = Object.keys(wordsByLength).map(Number).sort((a, b) => a - b);

    lengths.forEach(length => {
        const words = wordsByLength[length];

        // Create column
        const column = document.createElement('div');
        column.className = 'word-column';

        // Add width class based on word length
        column.classList.add(`word-column-${length}`);

        // Column header
        const header = document.createElement('div');
        header.className = 'word-column-header';
        header.textContent = `${length} HARF`;
        column.appendChild(header);

        // Word list
        const wordList = document.createElement('div');
        wordList.className = 'word-column-list';

        words.forEach(word => {
            const wordItem = document.createElement('div');
            wordItem.className = 'word-item';

            // Check if word was found
            if (gameState.foundWords.includes(word)) {
                wordItem.classList.add('found');
            } else {
                wordItem.classList.add('missed');
            }

            wordItem.textContent = word;

            // Add click handler to show definition
            wordItem.style.cursor = 'pointer';
            wordItem.addEventListener('click', () => showWordDefinition(word));

            wordList.appendChild(wordItem);
        });

        column.appendChild(wordList);
        wordsGrid.appendChild(column);
    });







    // Show modal
    elements.endGameModal.classList.add('show');
}

function restartGame() {
    elements.endGameModal.classList.remove('show');
    elements.startScreen.style.display = 'flex';
    elements.lettersSection.style.display = 'none';
    elements.inputSection.style.display = 'none';
    elements.foundWordsSection.style.display = 'none';
    elements.playerPanelsContainer.style.display = 'none';

    // Reset game state
    gameState.gameMode = 'single';
    gameState.currentRound = 1;
    gameState.restartButtonAction = 'restart';

    // Reset restart button to default
    elements.btnRestart.textContent = 'YENİDEN OYNA';
}

// ===== WORD DEFINITION FROM TDK =====
async function showWordDefinition(word) {
    // Show modal
    elements.definitionModal.classList.add('show');
    elements.definitionWord.textContent = word;
    elements.definitionBody.innerHTML = '<div class="loading-spinner">Yükleniyor...</div>';

    const tdkUrl = `https://sozluk.gov.tr/gts?ara=${encodeURIComponent(word)}`;
    
    // Daha fazla CORS proxy seçeneği
    const proxies = [
        `https://api.allorigins.win/get?url=${encodeURIComponent(tdkUrl)}`,
        `https://corsproxy.io/?${encodeURIComponent(tdkUrl)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(tdkUrl)}`
    ];

    for (let i = 0; i < proxies.length; i++) {
        try {
            // 2 saniye timeout ekle
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            
            const response = await fetch(proxies[i], {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            let data = await response.json();
            
            // allorigins.win özel format döndürür
            if (data.contents) {
                data = JSON.parse(data.contents);
            }

            if (!data || data.error || !Array.isArray(data) || data.length === 0) {
                if (i === proxies.length - 1) {
                    elements.definitionBody.innerHTML = '<div class="error-message">Bu kelime için anlam bulunamadı.</div>';
                }
                throw new Error('Geçersiz yanıt');
            }

            if (!data[0].anlamlarListe || data[0].anlamlarListe.length === 0) {
                elements.definitionBody.innerHTML = '<div class="error-message">Bu kelime için anlam bulunamadı.</div>';
                return;
            }

            // Build definition HTML
            let definitionHTML = '<div class="definition-content">';

            data[0].anlamlarListe.forEach((anlam, index) => {
                definitionHTML += `
                    <div class="definition-item">
                        <div class="definition-meaning">
                            <strong>${index + 1}.</strong> ${anlam.anlam}
                        </div>`;

                // Add examples if available
                if (anlam.orneklerListe && anlam.orneklerListe.length > 0) {
                    anlam.orneklerListe.forEach(ornek => {
                        if (ornek.ornek) {
                            definitionHTML += `
                                <div class="definition-example">
                                    "${ornek.ornek}"
                                </div>`;
                        }
                    });
                }

                definitionHTML += '</div>';
            });

            definitionHTML += '</div>';
            elements.definitionBody.innerHTML = definitionHTML;
            return; // Başarılı, fonksiyondan çık

        } catch (error) {
            // Son proxy de başarısız olduysa hata göster
            if (i === proxies.length - 1) {
                elements.definitionBody.innerHTML = `
                    <div class="error-message">
                        ⚠️ TDK'ya bağlanılamıyor.<br>
                        <small style="margin-top: 15px; display: block; font-size: 0.9rem;">
                            <a href="https://sozluk.gov.tr/gts?ara=${encodeURIComponent(word)}" 
                               target="_blank" 
                               style="color: #4ecdc4; text-decoration: underline; font-weight: 600;">
                               TDK sitesinde aç →
                            </a>
                        </small>
                    </div>
                `;
            }
            // Sonraki proxy'yi dene
        }
    }
}

function closeDefinitionModal() {
    elements.definitionModal.classList.remove('show');
}

// ===== MULTIPLAYER MODE FUNCTIONS =====

// Setup player inputs
function setupPlayerInputs() {
    const container = elements.playerInputsContainer;
    const currentCount = container.querySelectorAll('.player-input').length;

    // Update add button state
    elements.btnAddPlayer.disabled = currentCount >= 5;
}

function addPlayerInput() {
    const container = elements.playerInputsContainer;
    const currentCount = container.querySelectorAll('.player-input').length;

    if (currentCount < 5) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'player-input';
        input.placeholder = `${currentCount + 1}. Oyuncu Adı`;
        input.maxLength = 15;
        container.appendChild(input);
        setupPlayerInputs();
    }
}

function validatePlayerSetup() {
    const inputs = elements.playerInputsContainer.querySelectorAll('.player-input');
    const names = [];

    for (let input of inputs) {
        const name = input.value.trim();
        if (name) {
            names.push(name);
        }
    }

    if (names.length < 2) {
        alert('En az 2 oyuncu gerekli!');
        return null;
    }

    return names;
}

function setupMultiplayerGame() {
    const playerNames = validatePlayerSetup();
    if (!playerNames) return;

    // Initialize game state for multiplayer
    gameState.gameMode = 'multiplayer';
    gameState.players = playerNames.map(name => ({
        name: name,
        score: 0,
        turnsPlayed: 0
    }));
    gameState.currentPlayerIndex = 0;
    gameState.currentRound = 1;
    gameState.totalRounds = parseInt(elements.roundSelector.value);

    // Hide setup screen, show game area
    elements.playerSetupScreen.style.display = 'none';

    // Start first round
    startMultiplayerRound();
}

function startMultiplayerRound() {
    // CRITICAL: Clear any existing timer interval to prevent conflicts
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }

    // Reset round state
    gameState.letters = generateLetters();
    gameState.foundWords = [];
    gameState.isPlaying = true;
    gameState.currentPlayerIndex = 0;

    // Reset all players' turns for this round
    gameState.players.forEach(player => player.turnsPlayed = 0);

    // Find all valid words
    gameState.validWords = findValidWords(gameState.letters);
    gameState.longestWordLength = Math.max(...gameState.validWords.map(w => w.length));
    gameState.longestWordsFound = [];

    console.log(`El ${gameState.currentRound}/${gameState.totalRounds} başladı`);
    console.log(`Geçerli kelimeler (${gameState.validWords.length}):`, gameState.validWords);

    // Update UI
    elements.lettersSection.style.display = 'block';
    elements.inputSection.style.display = 'block';
    elements.foundWordsSection.style.display = 'block';
    elements.playerPanelsContainer.style.display = 'flex';

    // Display letters
    elements.lettersContainer.innerHTML = '';
    gameState.letters.forEach(letter => {
        const card = document.createElement('div');
        card.className = 'letter-card';
        card.textContent = letter.toLocaleUpperCase('tr-TR');
        elements.lettersContainer.appendChild(card);
    });

    // Reset found words display
    elements.foundWordsContainer.innerHTML = '<p class="empty-message">Henüz kelime bulunamadı...</p>';
    elements.foundCount.textContent = '0';

    // Create player panels
    createPlayerPanels();

    // Enable input
    elements.wordInput.disabled = false;
    elements.wordInput.value = '';

    // Start first player's turn
    startPlayerTurn();
}

function createPlayerPanels() {
    elements.playerPanelsContainer.innerHTML = '';

    gameState.players.forEach((player, index) => {
        const panel = document.createElement('div');
        panel.className = 'player-panel';
        panel.id = `player-panel-${index}`;

        const nameDiv = document.createElement('div');
        nameDiv.className = 'player-name';
        nameDiv.textContent = player.name;

        const scoreDiv = document.createElement('div');
        scoreDiv.className = 'player-score';
        scoreDiv.textContent = player.score;

        panel.appendChild(nameDiv);
        panel.appendChild(scoreDiv);
        elements.playerPanelsContainer.appendChild(panel);
    });

    updatePlayerPanels();
}

function updatePlayerPanels() {
    gameState.players.forEach((player, index) => {
        const panel = document.getElementById(`player-panel-${index}`);
        if (panel) {
            const scoreDiv = panel.querySelector('.player-score');
            scoreDiv.textContent = player.score;

            // Highlight active player
            if (index === gameState.currentPlayerIndex) {
                panel.classList.add('active');
            } else {
                panel.classList.remove('active');
            }
        }
    });
}

function startPlayerTurn() {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    console.log(`${currentPlayer.name}'in sırası (${currentPlayer.turnsPlayed + 1}/5)`);

    // Reset turn state
    gameState.turnTimeLeft = 5;
    gameState.timerPaused = false;

    // Update UI
    updatePlayerPanels();
    elements.wordInput.value = '';
    elements.wordInput.focus();

    // Start turn timer
    updateTurnTimer();
    gameState.timerInterval = setInterval(updateTurnTimer, 1000);
}

function updateTurnTimer() {
    elements.timer.textContent = gameState.turnTimeLeft;

    // Warning animation
    if (gameState.turnTimeLeft <= 3) {
        elements.timer.classList.add('warning');
        if (!gameState.timerPaused) {
            playTickSound();
        }
    } else {
        elements.timer.classList.remove('warning');
    }

    if (gameState.turnTimeLeft <= 0) {
        // Time's up, switch to next player
        switchToNextPlayer();
        return;
    }

    // Only decrease time if not paused
    if (!gameState.timerPaused) {
        gameState.turnTimeLeft--;
    }
}

function switchToNextPlayer() {
    clearInterval(gameState.timerInterval);

    // Mark turn as played
    gameState.players[gameState.currentPlayerIndex].turnsPlayed++;

    // Check if round is complete
    if (checkRoundCompletion()) {
        endRound();
        return;
    }

    // Move to next player
    gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;

    // Start next turn
    setTimeout(() => startPlayerTurn(), 200);
}

function checkRoundCompletion() {
    // Check if all players have played all their turns
    return gameState.players.every(player => player.turnsPlayed >= gameState.turnsPerRound);
}

function submitWordMultiplayer() {
    if (!gameState.isPlaying) return;

    const rawInput = elements.wordInput.value.trim().toLocaleLowerCase('tr-TR');
    const input = normalizeWord(rawInput);

    if (!input) return;

    // Pause timer on first keypress is handled in keypress event

    // Check if word is valid
    if (!gameState.validWords.includes(input)) {
        playWrongSound();
        elements.wordInput.classList.add('shake');
        setTimeout(() => {
            elements.wordInput.classList.remove('shake');
            elements.wordInput.value = '';
            switchToNextPlayer(); // Auto-switch on wrong answer
        }, 200);
        return;
    }

    // Check if already found
    if (gameState.foundWords.includes(input)) {
        playDuplicateSound();
        elements.wordInput.classList.add('shake');
        setTimeout(() => {
            elements.wordInput.classList.remove('shake');
            elements.wordInput.value = '';
            switchToNextPlayer(); // Auto-switch on duplicate
        }, 200);
        return;
    }

    // Correct word!
    gameState.foundWords.push(input);

    // Calculate points
    const isLongestWord = input.length === gameState.longestWordLength;
    let points = input.length * 10;

    if (isLongestWord && !gameState.longestWordsFound.includes(input)) {
        points = points * 2;
        gameState.longestWordsFound.push(input);
        playApplauseSound();
        console.log(`🎉 BONUS! ${gameState.players[gameState.currentPlayerIndex].name} en uzun kelimeyi buldu: "${input}"`);
    } else {
        playCorrectSound();
    }

    // Award points to current player
    gameState.players[gameState.currentPlayerIndex].score += points;
    updatePlayerPanels();

    // Update found words display
    if (gameState.foundWords.length === 1) {
        elements.foundWordsContainer.innerHTML = '';
    }

    const wordTag = document.createElement('div');
    wordTag.className = 'word-tag';
    wordTag.textContent = input;
    elements.foundWordsContainer.appendChild(wordTag);

    elements.foundCount.textContent = gameState.foundWords.length;

    // Clear input and switch to next player
    elements.wordInput.value = '';
    switchToNextPlayer();
}

function endRound() {
    console.log('=== endRound CALLED ===');
    console.log('Current round:', gameState.currentRound);

    // Prevent multiple calls
    if (!gameState.isPlaying) {
        console.log('endRound already called, skipping');
        return;
    }

    gameState.isPlaying = false;
    clearInterval(gameState.timerInterval);
    gameState.timerInterval = null;
    elements.wordInput.disabled = true;

    playEndSound();

    // Show all words first (like end game)
    showRoundWords();
}

function showRoundWords() {
    console.log('=== showRoundWords CALLED ===');
    console.log('Game mode:', gameState.gameMode);
    console.log('Current round:', gameState.currentRound);

    // Calculate statistics
    const totalWords = gameState.validWords.length;
    const foundCount = gameState.foundWords.length;
    const missedCount = totalWords - foundCount;
    const successPercentage = totalWords > 0 ? Math.round((foundCount / totalWords) * 100) : 0;

    // Update modal header - show round number
    const titleElement = document.querySelector('.stat-title .stat-value');
    if (titleElement) {
        titleElement.textContent = `${gameState.currentRound}. EL - TÜM KELİMELER`;
    }

    // Update statistics
    document.getElementById('statsFound').textContent = foundCount;
    document.getElementById('statsMissed').textContent = missedCount;
    document.getElementById('statsTotal').textContent = totalWords;
    document.getElementById('statsPercentage').textContent = successPercentage + '%';

    // Hide final score (not relevant for round end)
    elements.finalScore.parentElement.style.display = 'none';

    // Group words by length
    const wordsByLength = {};
    gameState.validWords.forEach(word => {
        const len = word.length;
        if (!wordsByLength[len]) {
            wordsByLength[len] = [];
        }
        wordsByLength[len].push(word);
    });

    Object.keys(wordsByLength).forEach(len => {
        wordsByLength[len].sort((a, b) => a.localeCompare(b, 'tr-TR'));
    });

    const wordsGrid = document.getElementById('wordsGrid');
    wordsGrid.innerHTML = '';

    const lengths = Object.keys(wordsByLength).map(Number).sort((a, b) => a - b);

    lengths.forEach(length => {
        const words = wordsByLength[length];
        const column = document.createElement('div');
        column.className = 'word-column';
        column.classList.add(`word-column-${length}`);

        const header = document.createElement('div');
        header.className = 'word-column-header';
        header.textContent = `${length} HARF`;
        column.appendChild(header);

        const wordList = document.createElement('div');
        wordList.className = 'word-column-list';

        words.forEach(word => {
            const wordItem = document.createElement('div');
            wordItem.className = 'word-item';

            if (gameState.foundWords.includes(word)) {
                wordItem.classList.add('found');
            } else {
                wordItem.classList.add('missed');
            }

            wordItem.textContent = word;
            wordItem.addEventListener('click', () => showWordDefinition(word));
            wordList.appendChild(wordItem);
        });

        column.appendChild(wordList);
        wordsGrid.appendChild(column);
    });

    // Change restart button to "Puan Durumuna Geç"
    console.log('Setting restart button action to showRoundSummary');
    elements.btnRestart.textContent = 'PUAN DURUMUNA GEÇ →';
    gameState.restartButtonAction = 'showRoundSummary';
    console.log('restartButtonAction set to:', gameState.restartButtonAction);

    // Show modal
    elements.endGameModal.style.display = ''; // Reset inline style from previous close
    elements.endGameModal.classList.add('show');
}

function showRoundSummary() {
    console.log(`showRoundSummary çağrıldı - El ${gameState.currentRound}/${gameState.totalRounds}`);
    console.log('Modal element:', elements.roundSummaryModal);

    // CRITICAL: Make sure endGameModal is completely hidden
    elements.endGameModal.classList.remove('show');
    elements.endGameModal.style.display = 'none';

    // Update title
    elements.roundSummaryTitle.textContent = `${gameState.currentRound}. EL TAMAMLANDI!`;

    // Sort players by score (descending)
    const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);

    // Create scores table
    elements.scoresTable.innerHTML = '';
    sortedPlayers.forEach((player, index) => {
        const row = document.createElement('div');
        row.className = 'score-row';
        if (index === 0) row.classList.add('winner');

        const nameSpan = document.createElement('span');
        nameSpan.className = 'score-player-name';
        nameSpan.textContent = `${index + 1}. ${player.name}`;

        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'score-player-score';
        scoreSpan.textContent = player.score;

        row.appendChild(nameSpan);
        row.appendChild(scoreSpan);
        elements.scoresTable.appendChild(row);
    });

    // Update button text
    if (gameState.currentRound < gameState.totalRounds) {
        elements.btnContinueRound.textContent = 'SONRAKİ ELE GEÇ →';
        console.log('Buton metni: SONRAKİ ELE GEÇ →');
    } else {
        elements.btnContinueRound.textContent = 'SONUÇLARI GÖR →';
        console.log('Buton metni: SONUÇLARI GÖR →');
    }

    // Show modal
    elements.roundSummaryModal.classList.add('show');
}

function continueToNextRound() {
    console.log('=== continueToNextRound CALLED ===');
    console.log('Current round before increment:', gameState.currentRound);
    console.log('Total rounds:', gameState.totalRounds);
    elements.roundSummaryModal.classList.remove('show');

    if (gameState.currentRound < gameState.totalRounds) {
        // Increment round BEFORE starting next round
        gameState.currentRound++;
        console.log(`Sonraki ele geçiliyor: El ${gameState.currentRound}/${gameState.totalRounds}`);
        startMultiplayerRound();
    } else {
        // Game over, show final results
        showMultiplayerResults();
    }
}

function showMultiplayerResults() {
    // Sort players by score
    const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);
    const winner = sortedPlayers[0];

    // Update modal with winner info
    elements.finalScore.textContent = winner.score;

    // Update statistics
    const totalWords = gameState.validWords.length;
    const foundCount = gameState.foundWords.length;
    const missedCount = totalWords - foundCount;
    const successPercentage = totalWords > 0 ? Math.round((foundCount / totalWords) * 100) : 0;

    document.getElementById('statsFound').textContent = foundCount;
    document.getElementById('statsMissed').textContent = missedCount;
    document.getElementById('statsTotal').textContent = totalWords;
    document.getElementById('statsPercentage').textContent = successPercentage + '%';

    // Customize title for multiplayer
    const titleElement = document.querySelector('.stat-title .stat-value');
    if (titleElement) {
        titleElement.textContent = `🎉 ${winner.name.toUpperCase()} KAZANDI!`;
    }

    // Show words grid (same as single player)
    const wordsByLength = {};
    gameState.validWords.forEach(word => {
        const len = word.length;
        if (!wordsByLength[len]) {
            wordsByLength[len] = [];
        }
        wordsByLength[len].push(word);
    });

    Object.keys(wordsByLength).forEach(len => {
        wordsByLength[len].sort((a, b) => a.localeCompare(b, 'tr-TR'));
    });

    const wordsGrid = document.getElementById('wordsGrid');
    wordsGrid.innerHTML = '';

    const lengths = Object.keys(wordsByLength).map(Number).sort((a, b) => a - b);

    lengths.forEach(length => {
        const words = wordsByLength[length];
        const column = document.createElement('div');
        column.className = 'word-column';
        column.classList.add(`word-column-${length}`);

        const header = document.createElement('div');
        header.className = 'word-column-header';
        header.textContent = `${length} HARF`;
        column.appendChild(header);

        const wordList = document.createElement('div');
        wordList.className = 'word-column-list';

        words.forEach(word => {
            const wordItem = document.createElement('div');
            wordItem.className = 'word-item';

            if (gameState.foundWords.includes(word)) {
                wordItem.classList.add('found');
            } else {
                wordItem.classList.add('missed');
            }

            wordItem.textContent = word;
            wordItem.addEventListener('click', () => showWordDefinition(word));
            wordList.appendChild(wordItem);
        });

        column.appendChild(wordList);
        wordsGrid.appendChild(column);
    });

    // Show modal
    elements.endGameModal.classList.add('show');
}

// ===== EVENT LISTENERS =====

// Mode selection
elements.btnSinglePlayer.addEventListener('click', () => {
    gameState.gameMode = 'single';
    startGame(); // Use existing single player game
});

elements.btnMultiplayer.addEventListener('click', () => {
    elements.startScreen.style.display = 'none';
    elements.playerSetupScreen.style.display = 'flex';
});

// Player setup
elements.btnAddPlayer.addEventListener('click', addPlayerInput);

elements.btnBackToMode.addEventListener('click', () => {
    elements.playerSetupScreen.style.display = 'none';
    elements.startScreen.style.display = 'flex';
});

elements.btnStartMultiplayer.addEventListener('click', setupMultiplayerGame);

// Round summary
elements.btnContinueRound.addEventListener('click', continueToNextRound);

// Restart game - handle different actions based on game state
elements.btnRestart.addEventListener('click', () => {
    console.log('=== RESTART BUTTON CLICKED ===');
    console.log('Current restartButtonAction:', gameState.restartButtonAction);
    console.log('Game mode:', gameState.gameMode);
    console.log('Current round:', gameState.currentRound);

    if (gameState.restartButtonAction === 'showRoundSummary') {
        console.log('Action: Showing round summary');
        elements.endGameModal.classList.remove('show');
        console.log('End game modal closed');
        // Add small delay to allow modal close animation to complete
        setTimeout(() => {
            console.log('Calling showRoundSummary after delay...');
            showRoundSummary();
        }, 300);
    } else {
        console.log('Action: Restarting game');
        restartGame();
    }
});
elements.btnCloseDefinition.addEventListener('click', closeDefinitionModal);

// Close definition modal when clicking outside
elements.definitionModal.addEventListener('click', (e) => {
    if (e.target === elements.definitionModal) {
        closeDefinitionModal();
    }
});

// Word input handling
elements.wordInput.addEventListener('input', (e) => {
    // Pause timer on first keypress in multiplayer mode
    if (gameState.gameMode === 'multiplayer' && gameState.isPlaying && !gameState.timerPaused) {
        if (e.target.value.length === 1) {
            gameState.timerPaused = true;
            console.log('Timer paused');
        }
    }
});

elements.wordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        if (gameState.gameMode === 'multiplayer') {
            submitWordMultiplayer();
        } else {
            submitWord();
        }
    }
});

// ===== LOAD DICTIONARY ON PAGE LOAD =====
window.addEventListener('DOMContentLoaded', async () => {
    // Disable mode buttons until dictionary is loaded
    elements.btnSinglePlayer.disabled = true;
    elements.btnMultiplayer.disabled = true;
    elements.btnSinglePlayer.textContent = 'SÖZLÜK YÜKLENİYOR...';
    elements.btnMultiplayer.textContent = 'SÖZLÜK YÜKLENİYOR...';

    // Load dictionary
    await loadDictionary();

    // Enable mode buttons
    elements.btnSinglePlayer.disabled = false;
    elements.btnMultiplayer.disabled = false;
    elements.btnSinglePlayer.innerHTML = '<span class="mode-icon">👤</span><span class="mode-title">TEK OYUNCU</span><span class="mode-desc">100 saniye süre ile klasik mod</span>';
    elements.btnMultiplayer.innerHTML = '<span class="mode-icon">👥</span><span class="mode-title">ÇOK OYUNCU</span><span class="mode-desc">Sırayla oyna, en yüksek puanı topla</span>';
});

// Main menu button
elements.btnMainMenu.addEventListener('click', () => {
    // Stop any ongoing game
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
    gameState.isPlaying = false;

    // Close any open modals
    elements.endGameModal.classList.remove('show');
    elements.roundSummaryModal.classList.remove('show');
    elements.definitionModal.classList.remove('show');

    // Reset and show start screen
    restartGame();
});
