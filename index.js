const path = require('path');
const fs = require('fs-extra');
const concat = require('lodash/fp/concat');
const flatten = require('lodash/fp/flatten');
const forEach = require('lodash/fp/forEach');
const indexOf = require('lodash/fp/indexOf');
const join = require('lodash/fp/join');
const map = require('lodash/fp/map');
const range = require('lodash/fp/range');
const set = require('lodash/fp/set');
const shuffle = require('lodash/fp/shuffle');
const slice = require('lodash/fp/slice');
const sortBy = require('lodash/fp/sortBy');
const update = require('lodash/fp/update');
const PdfPrinter = require('pdfmake');
const { cardsFontMap } = require('./cards-font-map');

const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const suits = ['♣︎', '♢', '♡', '♠︎'];
const deck = flatten(
  map(suit => map(value => ({
    value,
    suit,
    valueRank: indexOf(value, values),
    suitRank: indexOf(suit, suits),
    isRed: suit === '♢' || suit === '♡',
    name: `${value}${suit}`
  }), values), suits)
);
const doubleDeck = [...deck, ...deck];

const playerCounts = [6, 8, 10];
const rounds = 20;
const minKittySize = 4;

const heartsDir = 'hearts';
fs.removeSync(heartsDir); // so dangerous!

forEach(playerCount => {
  const players = map(p => ({ id: p, name: `Player ${p + 1}`, hands: [] }), range(0, playerCount));
  const kitties = [];
  let handSize = Math.floor(doubleDeck.length / playerCount);
  let kittySize = doubleDeck.length - (handSize * playerCount);
  if (kittySize < minKittySize) {
    handSize--;
    kittySize += playerCount;
  }
  console.log(`Player Count: ${playerCount}`);
  console.log('');
  forEach(round => {
    const roundLabel = `Round ${round + 1}`;
    const shuffledDeck = shuffle(doubleDeck);
    forEach(player => {
      const hand = sortBy(['suitRank', 'valueRank'], slice(player.id * handSize, (player.id + 1) * handSize, shuffledDeck));
      player.hands.push(hand);
      console.log(`   ${roundLabel}: ${player.name} - ${join(' ', map(card => card.name, hand))}`)
    }, players);
    const kitty = sortBy(['suitRank', 'valueRank'], slice(playerCount * handSize, shuffledDeck.length, shuffledDeck));
    kitties.push(kitty);
    console.log(`   ${roundLabel}: KITTY - ${join(' ', map(card => card.name, kitty))}`);
    console.log('');
  }, range(0, rounds));

  var fonts = {
    Helvetica: {
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italics: 'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique'
    },
    PlayingCards: {
      normal: 'fonts/playingcards.ttf'
    }
  };
  var printer = new PdfPrinter(fonts);
  var docDefinition = {
    content: [
    ],
    defaultStyle: {
      font: 'Helvetica',
      fontSize: 10,
      bold: false
    },
    styles: {
      header1: {
        fontSize: 14,
        bold: true,
        margin: 10
      },
      header2: {
        fontSize: 12,
        bold: true,
        margin: [ 0, 6, 0, 6 ]
      },
      card: {
        font: 'PlayingCards',
        fontSize: 39
      },
      black: {
        color: '#000000'
      },
      red: {
        color: '#ff0000'
      }
    }
  };
  const options = {};

  const gameDir = path.join(heartsDir, `${playerCount}-players`);
  fs.ensureDirSync(gameDir);
  forEach(player => {
    const playerFile = path.join(gameDir, `${player.name}_hands.pdf`);
    let playerDoc = set('header', [{ text: player.name, style: 'header1' }], docDefinition);
    let h = 1;
    forEach(hand => {
      const lines = [
        { text: `Hand ${h}`, style: 'header2' },
        { text: flatten(map(card => ([{ text: `${cardsFontMap[card.name]}`, style: [ 'card', card.isRed ? 'red' : 'black' ] }, ' ']), hand)) },
      ];
      playerDoc = update('content', (c) => concat(c, lines), playerDoc);
      h++;
    }, player.hands);
    const pdfDoc = printer.createPdfKitDocument(playerDoc, options);
    pdfDoc.pipe(fs.createWriteStream(playerFile));
    pdfDoc.end();
  }, players);
  const kittyDir = path.join(gameDir, 'KITTY');
  fs.ensureDirSync(kittyDir);
  let h = 1;
  forEach(kitty => {
    const kittyFile = path.join(kittyDir, `KITTY_hand-${h}.pdf`);
    let kittyDoc = set('header', [{ text: `KITTY - Hand ${h}`, style: 'header1' }], docDefinition);
    const lines = [
      { text: flatten(map(card => ([{ text: `${cardsFontMap[card.name]}`, style: [ 'card', card.isRed ? 'red' : 'black' ] }, ' ']), kitty)) }
    ];
    kittyDoc = update('content', (c) => concat(c, lines), kittyDoc);
    const pdfDoc = printer.createPdfKitDocument(kittyDoc, options);
    pdfDoc.pipe(fs.createWriteStream(kittyFile));
    pdfDoc.end();
    h++;
  }, kitties);
}, playerCounts);
