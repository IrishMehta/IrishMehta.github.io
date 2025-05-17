// js/animations/typing.js

// Constants
export const typingStartDelay = 500; // ms delay before typing starts
const typingSpeed = 100; // ms between characters
const erasingSpeed = 20; // ms between characters when erasing
const pauseBetweenPhrases = 800; // ms pause at end of phrase
const pauseBeforeErasing = 1200; // ms pause before erasing starts

// Elements
let headingEl;
let typingTextEl;
let cursorEl;

// Phrases for title cycling
const welcomeSmallText = "HELLO!";
const nameText = "I'm Irish Mehta";
const titlePhrases = [
    "A Data Scientist",
    "A Developer",
    "A Machine Learning Engineer"
];

// State
let currentPhraseIndex = 0;
let isErasing = false;
let isTypingHeading = false;
let charIndex = 0;

/**
 * Initialize typing animation with DOM elements
 */
function init() {
    headingEl = document.getElementById('home-heading');
    typingTextEl = document.getElementById('typing-text');
    cursorEl = document.querySelector('.typing-cursor');
    
    if (!headingEl || !typingTextEl || !cursorEl) {
        console.error('Typing animation elements not found!');
        return false;
    }
    
    // Show the cursor
    cursorEl.classList.add('visible');
    
    return true;
}

/**
 * Start the complete typing sequence
 */
export function startTypingSequence() {
    if (!init()) return;
    
    // First, type the welcome message in the heading
    typeHeading();
}

/**
 * Type the welcome heading
 */
function typeHeading() {
    // Reset state
    isTypingHeading = true;
    charIndex = 0;
    cursorEl.classList.add('blinking');

    // Step 1: Type 'Welcome' in big size
    headingEl.innerHTML = '<span class="welcome-big"></span>';
    const bigSpan = headingEl.querySelector('.welcome-big');
    typeNextChar(welcomeSmallText, bigSpan, () => {
        // Add delay here before starting the shrink animation
        setTimeout(() => {
            // Step 2: Shrink welcome to small size
            bigSpan.classList.add('shrink-to-small');
            bigSpan.classList.remove('welcome-big');
            bigSpan.classList.add('welcome-small');

            // After shrink animation completes, type the name
            setTimeout(() => {
                isTypingHeading = false;
                charIndex = 0;
                // Prepare name and title spans along with inline cursor
                typingTextEl.innerHTML = '<span class="name-text"></span><br><span class="title-text"></span><span class="typing-cursor blinking visible"></span>';
                const nameSpan = typingTextEl.querySelector('.name-text');
                const titleSpan = typingTextEl.querySelector('.title-text');
                // Update cursorEl to the new inline cursor
                cursorEl = typingTextEl.querySelector('.typing-cursor');

                // Type the name
                typeNextChar(nameText, nameSpan, () => {
                    // Step 3: Start cycling titles in titleSpan
                    currentPhraseIndex = 0;
                    typeTitle(titleSpan);
                });
            }, 1000); // allow shrink animation
        }, 1000); // Add a 2-second delay before shrinking - adjust this value as needed
    });
}

/**
 * Begin cycling through title phrases
 */
function startTitleCycle() {
    // This function is no longer needed as we combine everything in typeHeading
    // Just keeping it here for backward compatibility
    typeHeading();
}

/**
 * Handle the typing and erasing cycle of titles
 */
function typeTitle(titleSpan) {
    const currentPhrase = titlePhrases[currentPhraseIndex];
    
    if (!isErasing) {
        // Type the current title
        charIndex = 0;
        const typeCurrentTitle = () => {
            if (charIndex < currentPhrase.length) {
                titleSpan.textContent += currentPhrase.charAt(charIndex);
                charIndex++;
                setTimeout(typeCurrentTitle, typingSpeed);
            } else {
                // Done typing, schedule erasure
                setTimeout(() => {
                    isErasing = true;
                    erasePhrase(titleSpan);
                }, pauseBeforeErasing);
            }
        };
        
        typeCurrentTitle();
    } else {
        // We're now done erasing (handled in erasePhrase)
        isErasing = false;
        
        // Move to next phrase
        currentPhraseIndex = (currentPhraseIndex + 1) % titlePhrases.length;
        
        // Pause before typing the next phrase
        setTimeout(() => {
            typeTitle(titleSpan);
        }, pauseBetweenPhrases / 2);
    }
}

/**
 * Type a full phrase with callback when complete
 */
function typeFullPhrase(phrase, callback) {
    charIndex = 0;
    // Only clear text if we're not typing the initial name
    if (phrase !== nameText || typingTextEl.textContent === '') {
        typingTextEl.textContent = '';
    }
    typeNextChar(phrase, typingTextEl, callback);
}

/**
 * Erase the current phrase character by character
 */
function erasePhrase(titleSpan) {
    if (titleSpan.textContent.length > 0) {
        // Remove one character from the title part
        titleSpan.textContent = titleSpan.textContent.slice(0, -1);
        setTimeout(() => erasePhrase(titleSpan), erasingSpeed);
    } else {
        // Done erasing - we've reached back to just the name and <br>
        isErasing = false;
        // Pause before typing the next phrase
        setTimeout(() => {
            // Move to next phrase first
            currentPhraseIndex = (currentPhraseIndex + 1) % titlePhrases.length;
            typeTitle(titleSpan);
        }, pauseBetweenPhrases / 2);
    }
}

/**
 * Type the next character in a phrase
 */
function typeNextChar(phrase, element, callback) {
    if (charIndex < phrase.length) {
        // Add the next character
        if (element === typingTextEl && element.innerHTML.includes('<br>')) {
            // If we're typing after a line break, append to innerHTML 
            const currentHTML = element.innerHTML;
            element.innerHTML = currentHTML + phrase.charAt(charIndex);
        } else {
            // Otherwise just append to textContent
            element.textContent += phrase.charAt(charIndex);
        }
        charIndex++;
        
        // Schedule the next character
        setTimeout(() => typeNextChar(phrase, element, callback), typingSpeed);
    } else if (callback) {
        // If we have a callback, call it when done typing
        callback();
    } else if (isTypingHeading) {
        // If we just finished typing the heading, start the title cycle
        setTimeout(startTitleCycle, pauseBetweenPhrases);
    }
}

/**
 * Show all text immediately (for reduced motion)
 */
export function displayTypingImmediately() {
    if (!init()) return;
    
    // Show all text at once
    headingEl.innerHTML = '<span class="welcome-small">' + welcomeSmallText + '</span>';
    typingTextEl.innerHTML = `<span style="font-size: 2.5rem; font-weight: 700;">${nameText}</span><br>
                             <span style="font-size: 1.6rem; color: hsl(var(--clr-accent));">${titlePhrases.join(' • ')}</span>`;
    
    // Keep the cursor visible but not blinking
    cursorEl.classList.add('visible');
}