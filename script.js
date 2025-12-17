// ===== GAME STATE =====
const gameState = {
    letters: [],
    validWords: [],
    foundWords: [],
    score: 0,
    timeLeft: 100,
    timerInterval: null,
    isPlaying: false,
    wordDictionary: [],
    longestWordLength: 0,
    longestWordsFound: []
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
    startScreen: document.getElementById('startScreen'),
    btnStart: document.getElementById('btnStart'),
    lettersSection: document.getElementById('lettersSection'),
    lettersContainer: document.getElementById('lettersContainer'),
    inputSection: document.getElementById('inputSection'),
    wordInput: document.getElementById('wordInput'),
    foundWordsSection: document.getElementById('foundWordsSection'),
    foundWordsContainer: document.getElementById('foundWordsContainer'),
    foundCount: document.getElementById('foundCount'),
    timer: document.getElementById('timer'),
    score: document.getElementById('score'),
    endGameModal: document.getElementById('endGameModal'),
    finalScore: document.getElementById('finalScore'),
    foundCountModal: document.getElementById('foundCountModal'),
    missedCount: document.getElementById('missedCount'),
    foundWordsList: document.getElementById('foundWordsList'),
    missedWordsList: document.getElementById('missedWordsList'),
    btnRestart: document.getElementById('btnRestart')
};

// ===== INITIALIZATION =====
async function loadDictionary() {
    try {
        const response = await fetch('turkce_kelime_listesi.txt');
        const text = await response.text();
        gameState.wordDictionary = text
            .split('\n')
            .map(word => word.trim().toLocaleLowerCase('tr-TR'))
            .filter(word => word.length >= 4);
        console.log(`Sözlük yüklendi: ${gameState.wordDictionary.length} kelime`);
    } catch (error) {
        console.warn('Sözlük dosyası yüklenemedi, demo kelimeler kullanılıyor');
        // Fallback demo word list
        gameState.wordDictionary = [
            'ev', 'el', 'at', 'su', 'ot', 'ok', 'ay', 'göz', 'kol', 'baş',
            'dal', 'kal', 'sal', 'mal', 'bal', 'hal', 'yol', 'gül', 'kır', 'yer',
            'ver', 'gel', 'git', 'dur', 'tur', 'kur', 'bul', 'yaz', 'oku', 'ara',
            'dere', 'kale', 'bale', 'yare', 'kare', 'tane', 'sade', 'yade', 'rade',
            'masa', 'kasa', 'sasa', 'dere', 'tere', 'bere', 'kere', 'sere',
            'kedi', 'deli', 'beli', 'teli', 'seli', 'yeli', 'kedi', 'gemi',
            'deniz', 'reniz', 'teniz', 'demir', 'remir', 'temir', 'semir',
            'kartal', 'bartal', 'sartal', 'dartal', 'tartal', 'martal',
            'ağaç', 'bağaç', 'dağaç', 'sağaç', 'yağaç', 'kağıt', 'sağıt',
            'kitap', 'sitap', 'ritap', 'mitap', 'kalem', 'salem', 'dalem',
            'masa', 'kasa', 'sasa', 'yasa', 'dere', 'tere', 'bere', 'sere',
            'erik', 'erim', 'erit', 'eris', 'erik', 'erin', 'eril', 'erik'
        ];
    }
}

// ===== WEIGHTED RANDOM SELECTION =====
function weightedRandomSelection(items, weights, count) {
    const selected = [];
    const availableItems = [...items];
    const availableWeights = [...weights];

    for (let i = 0; i < count; i++) {
        if (availableItems.length === 0) break;

        const totalWeight = availableWeights.reduce((sum, w) => sum + w, 0);
        let random = Math.random() * totalWeight;

        let selectedIndex = 0;
        for (let j = 0; j < availableWeights.length; j++) {
            random -= availableWeights[j];
            if (random <= 0) {
                selectedIndex = j;
                break;
            }
        }

        selected.push(availableItems[selectedIndex]);
        availableItems.splice(selectedIndex, 1);
        availableWeights.splice(selectedIndex, 1);
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

    const input = elements.wordInput.value.trim().toLocaleLowerCase('tr-TR');

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
        playWrongSound();
        elements.wordInput.classList.add('shake');
        setTimeout(() => elements.wordInput.classList.remove('shake'), 500);
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
}

// ===== EVENT LISTENERS =====
elements.btnRestart.addEventListener('click', restartGame);

elements.wordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        submitWord();
    }
});

// ===== LOAD DICTIONARY ON PAGE LOAD =====
window.addEventListener('DOMContentLoaded', async () => {
    // Disable start button until dictionary is loaded
    elements.btnStart.disabled = true;
    elements.btnStart.textContent = 'SÖZLÜK YÜKLENİYOR...';

    // Load dictionary
    await loadDictionary();

    // Enable start button
    elements.btnStart.disabled = false;
    elements.btnStart.textContent = 'OYUNU BAŞLAT';

    // Add click listener after dictionary is loaded
    elements.btnStart.addEventListener('click', startGame);
});

