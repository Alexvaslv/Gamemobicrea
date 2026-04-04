
const weapons = [
    {"id":1,"name":"Железный меч","rarity":"серый"},
    {"id":2,"name":"Стальной меч","rarity":"серый"},
    {"id":3,"name":"Короткий кинжал","rarity":"серый"},
    {"id":4,"name":"Боевой топор","rarity":"зелёный"},
    {"id":5,"name":"Копьё","rarity":"серый"},
    {"id":6,"name":"Ледяной меч","rarity":"синий"},
    {"id":7,"name":"Огненный топор","rarity":"синий"},
    {"id":8,"name":"Ядовитый кинжал","rarity":"зелёный"},
    {"id":9,"name":"Молот войны","rarity":"зелёный"},
    {"id":10,"name":"Катана","rarity":"синий"},
    {"id":11,"name":"Теневой клинок","rarity":"фиолетовый"},
    {"id":12,"name":"Меч молнии","rarity":"синий"},
    {"id":13,"name":"Кровавый топор","rarity":"фиолетовый"},
    {"id":14,"name":"Клинок ветра","rarity":"синий"},
    {"id":15,"name":"Двуручный меч","rarity":"зелёный"},
    {"id":16,"name":"Посох огня","rarity":"синий"},
    {"id":17,"name":"Посох льда","rarity":"синий"},
    {"id":18,"name":"Посох тьмы","rarity":"фиолетовый"},
    {"id":19,"name":"Арбалет","rarity":"зелёный"},
    {"id":20,"name":"Лук охотника","rarity":"зелёный"},
    {"id":21,"name":"Лук теней","rarity":"фиолетовый"},
    {"id":22,"name":"Лук света","rarity":"жёлтый"},
    {"id":23,"name":"Золотой меч","rarity":"жёлтый"},
    {"id":24,"name":"Клинок дракона","rarity":"жёлтый"},
    {"id":25,"name":"Демонический меч","rarity":"фиолетовый"},
    {"id":26,"name":"Молот титана","rarity":"жёлтый"},
    {"id":27,"name":"Коса смерти","rarity":"фиолетовый"},
    {"id":28,"name":"Кристальный меч","rarity":"синий"},
    {"id":29,"name":"Обсидиановый клинок","rarity":"фиолетовый"},
    {"id":30,"name":"Легендарный меч героя","rarity":"жёлтый"}
];

const armor = [
    {"id":31,"name":"Тканевая рубашка","rarity":"серый"},
    {"id":32,"name":"Кожаная броня","rarity":"зелёный"},
    {"id":33,"name":"Кольчужный доспех","rarity":"зелёный"},
    {"id":34,"name":"Железная броня","rarity":"серый"},
    {"id":35,"name":"Стальная броня","rarity":"зелёный"},
    {"id":36,"name":"Ледяная броня","rarity":"синий"},
    {"id":37,"name":"Огненная броня","rarity":"синий"},
    {"id":38,"name":"Теневая броня","rarity":"фиолетовый"},
    {"id":39,"name":"Святая броня","rarity":"жёлтый"},
    {"id":40,"name":"Доспех дракона","rarity":"жёлтый"},
    {"id":41,"name":"Плащ теней","rarity":"фиолетовый"},
    {"id":42,"name":"Плащ мага","rarity":"синий"},
    {"id":43,"name":"Плащ огня","rarity":"синий"},
    {"id":44,"name":"Плащ льда","rarity":"синий"},
    {"id":45,"name":"Броня берсерка","rarity":"фиолетовый"},
    {"id":46,"name":"Броня паладина","rarity":"жёлтый"},
    {"id":47,"name":"Броня ассасина","rarity":"фиолетовый"},
    {"id":48,"name":"Броня стража","rarity":"зелёный"},
    {"id":49,"name":"Броня титана","rarity":"жёлтый"},
    {"id":50,"name":"Демоническая броня","rarity":"фиолетовый"},
    {"id":51,"name":"Кристальная броня","rarity":"синий"},
    {"id":52,"name":"Обсидиановая броня","rarity":"фиолетовый"},
    {"id":53,"name":"Золотая броня","rarity":"жёлтый"},
    {"id":54,"name":"Броня духа","rarity":"фиолетовый"},
    {"id":55,"name":"Броня ветра","rarity":"синий"},
    {"id":56,"name":"Броня земли","rarity":"зелёный"},
    {"id":57,"name":"Броня молнии","rarity":"синий"},
    {"id":58,"name":"Броня хаоса","rarity":"фиолетовый"},
    {"id":59,"name":"Легендарный доспех героя","rarity":"жёлтый"},
    {"id":60,"name":"Броня бессмертия","rarity":"жёлтый"}
];

const potions = [
    {"id":61,"name":"Зелье здоровья","rarity":"зелёный"},
    {"id":62,"name":"Зелье маны","rarity":"синий"},
    {"id":63,"name":"Малое зелье силы","rarity":"зелёный"},
    {"id":64,"name":"Зелье скорости","rarity":"зелёный"},
    {"id":65,"name":"Зелье защиты","rarity":"зелёный"},
    {"id":66,"name":"Эликсир огня","rarity":"синий"},
    {"id":67,"name":"Эликсир льда","rarity":"синий"},
    {"id":68,"name":"Эликсир молнии","rarity":"синий"},
    {"id":69,"name":"Ядовитое зелье","rarity":"зелёный"},
    {"id":70,"name":"Тёмный эликсир","rarity":"фиолетовый"},
    {"id":71,"name":"Светлый эликсир","rarity":"жёлтый"},
    {"id":72,"name":"Эликсир ярости","rarity":"фиолетовый"},
    {"id":73,"name":"Эликсир невидимости","rarity":"фиолетовый"},
    {"id":74,"name":"Эликсир удачи","rarity":"жёлтый"},
    {"id":75,"name":"Эликсир опыта","rarity":"жёлтый"},
    {"id":76,"name":"Эликсир регенерации","rarity":"зелёный"},
    {"id":77,"name":"Эликсир энергии","rarity":"синий"},
    {"id":78,"name":"Эликсир берсерка","rarity":"фиолетовый"},
    {"id":79,"name":"Легендарный эликсир","rarity":"жёлтый"},
    {"id":80,"name":"Эликсир бессмертия","rarity":"жёлтый"}
];

const books = [
    {"id":81,"name":"Книга силы","rarity":"зелёный"},
    {"id":82,"name":"Книга ловкости","rarity":"зелёный"},
    {"id":83,"name":"Книга интеллекта","rarity":"синий"},
    {"id":84,"name":"Книга защиты","rarity":"зелёный"},
    {"id":85,"name":"Книга магии","rarity":"синий"},
    {"id":86,"name":"Книга огня","rarity":"синий"},
    {"id":87,"name":"Книга льда","rarity":"синий"},
    {"id":88,"name":"Книга молнии","rarity":"синий"},
    {"id":89,"name":"Тёмный гримуар","rarity":"фиолетовый"},
    {"id":90,"name":"Священная книга","rarity":"жёлтый"}
];

const artifacts = [
    {"id":91,"name":"Амулет силы","rarity":"зелёный"},
    {"id":92,"name":"Кольцо маны","rarity":"синий"},
    {"id":93,"name":"Кольцо защиты","rarity":"зелёный"},
    {"id":94,"name":"Амулет огня","rarity":"синий"},
    {"id":95,"name":"Амулет льда","rarity":"синий"},
    {"id":96,"name":"Амулет тьмы","rarity":"фиолетовый"},
    {"id":97,"name":"Амулет света","rarity":"жёлтый"},
    {"id":98,"name":"Реликвия древних","rarity":"фиолетовый"},
    {"id":99,"name":"Сердце дракона","rarity":"жёлтый"},
    {"id":100,"name":"Легендарный артефакт","rarity":"жёлтый"}
];

const rarityMap = {
    "серый": { rarity: 'common', level: 1, cost: 100, bonus: 1, stats: { strength: 2, agility: 1, endurance: 3 } },
    "зелёный": { rarity: 'uncommon', level: 5, cost: 300, bonus: 5, stats: { strength: 4, agility: 2, endurance: 6 } },
    "синий": { rarity: 'rare', level: 10, cost: 1000, bonus: 10, stats: { strength: 8, agility: 4, endurance: 12 } },
    "фиолетовый": { rarity: 'epic', level: 20, cost: 5000, bonus: 20, stats: { strength: 16, agility: 8, endurance: 24 } },
    "жёлтый": { rarity: 'legendary', level: 30, cost: 20000, bonus: 30, stats: { strength: 30, agility: 15, endurance: 45 } }
};

const equipment = [];

weapons.forEach(w => {
    const r = rarityMap[w.rarity];
    equipment.push({
        id: `wpn_${w.id}`,
        name: w.name,
        level: r.level,
        rarity: r.rarity,
        type: 'Меч',
        cost: r.cost,
        currency: 'silver',
        bonusPercent: r.bonus,
        stats: { strength: r.stats.strength, agility: r.stats.agility, intuition: 0, endurance: 0, wisdom: 0 }
    });
});

armor.forEach(a => {
    const r = rarityMap[a.rarity];
    let type = 'Рубашка';
    if (a.name.toLowerCase().includes('плащ')) type = 'Рубашка';
    equipment.push({
        id: `arm_${a.id}`,
        name: a.name,
        level: r.level,
        rarity: r.rarity,
        type: type,
        cost: r.cost,
        currency: 'silver',
        bonusPercent: r.bonus,
        stats: { strength: 0, agility: 0, intuition: 0, endurance: r.stats.endurance, wisdom: 0 }
    });
});

artifacts.forEach(art => {
    const r = rarityMap[art.rarity];
    let type = 'Ожерелье';
    if (art.name.toLowerCase().includes('кольцо')) type = 'Перчатки';
    equipment.push({
        id: `amu_${art.id}`,
        name: art.name,
        level: r.level,
        rarity: r.rarity,
        type: type,
        cost: r.cost,
        currency: 'silver',
        bonusPercent: r.bonus,
        stats: { strength: Math.floor(r.stats.strength/2), agility: Math.floor(r.stats.agility/2), intuition: Math.floor(r.stats.strength/2), endurance: Math.floor(r.stats.endurance/2), wisdom: Math.floor(r.stats.strength/2) }
    });
});

const elixirs = potions.map(p => {
    const r = rarityMap[p.rarity];
    return {
        id: `elx_${p.id}`,
        name: p.name,
        level: r.level,
        rarity: r.rarity,
        type: 'elixir',
        cost: Math.floor(r.cost / 2),
        currency: 'silver',
        description: 'Эффект зелья',
        bonusPercent: 0,
        stats: { strength: 0, agility: 0, intuition: 0, endurance: 0, wisdom: 0 }
    };
});

const shopBooks = books.map(b => {
    const r = rarityMap[b.rarity];
    return {
        id: `bk_${b.id}`,
        name: b.name,
        level: r.level,
        rarity: r.rarity,
        type: 'book',
        cost: r.cost * 2,
        currency: 'silver',
        description: 'Навсегда увеличивает характеристики',
        bonusPercent: 0,
        stats: { strength: 0, agility: 0, intuition: 0, endurance: 0, wisdom: 0 }
    };
});

const result = {
    equipment,
    elixirs,
    books: shopBooks,
    chests: [
        { id: 'shop_chest_iron', name: 'Железный Сундук', level: 1, rarity: 'common', type: 'chest', cost: 10, currency: 'diamonds', description: 'Содержит случайные ресурсы и предметы', isChest: true, bonusPercent: 0, stats: { strength: 0, agility: 0, intuition: 0, endurance: 0, wisdom: 0 } },
        { id: 'shop_chest_gold', name: 'Золотой Сундук', level: 1, rarity: 'common', type: 'chest', cost: 50, currency: 'diamonds', description: 'Высокий шанс на редкие предметы', isChest: true, bonusPercent: 0, stats: { strength: 0, agility: 0, intuition: 0, endurance: 0, wisdom: 0 } },
    ],
    diamonds: [
        { id: 'shop_diamonds_10', name: '10 Алмазов', level: 1, rarity: 'common', type: 'diamonds', cost: 1000, currency: 'gold', amount: 10, bonusPercent: 0, stats: { strength: 0, agility: 0, intuition: 0, endurance: 0, wisdom: 0 } },
        { id: 'shop_diamonds_50', name: '50 Алмазов', level: 1, rarity: 'common', type: 'diamonds', cost: 4500, currency: 'gold', amount: 50, bonusPercent: 0, stats: { strength: 0, agility: 0, intuition: 0, endurance: 0, wisdom: 0 } },
    ]
};

console.log(JSON.stringify(result, null, 2));
