const fs = require('fs');

const weapons = [
  { name: 'Железный меч', rarity: 'gray', effect: '+5 к атаке', icon: 'iron_sword.png' },
  { name: 'Стальной меч', rarity: 'gray', effect: '+8 к атаке', icon: 'steel_sword.png' },
  { name: 'Короткий кинжал', rarity: 'gray', effect: '+3 к атаке', icon: 'dagger.png' },
  { name: 'Боевой топор', rarity: 'green', effect: '+10 к атаке', icon: 'battle_axe.png' },
  { name: 'Копьё', rarity: 'gray', effect: '+6 к атаке', icon: 'spear.png' },
  { name: 'Ледяной меч', rarity: 'blue', effect: '+12 к атаке, морозный урон', icon: 'ice_sword.png' },
  { name: 'Огненный топор', rarity: 'blue', effect: '+15 к атаке, огненный урон', icon: 'fire_axe.png' },
  { name: 'Ядовитый кинжал', rarity: 'green', effect: '+5 к атаке, яд', icon: 'poison_dagger.png' },
  { name: 'Молот войны', rarity: 'green', effect: '+18 к атаке', icon: 'war_hammer.png' },
  { name: 'Катана', rarity: 'blue', effect: '+14 к атаке', icon: 'katana.png' },
  { name: 'Теневой клинок', rarity: 'purple', effect: '+25 к атаке, кража жизни', icon: 'shadow_blade.png' },
  { name: 'Меч молнии', rarity: 'blue', effect: '+16 к атаке, шок', icon: 'lightning_sword.png' },
  { name: 'Кровавый топор', rarity: 'purple', effect: '+28 к атаке, кровотечение', icon: 'blood_axe.png' },
  { name: 'Клинок ветра', rarity: 'blue', effect: '+13 к атаке, скорость', icon: 'wind_blade.png' },
  { name: 'Двуручный меч', rarity: 'green', effect: '+20 к атаке', icon: 'two_handed_sword.png' },
  { name: 'Посох огня', rarity: 'blue', effect: '+15 к магии, огонь', icon: 'fire_staff.png' },
  { name: 'Посох льда', rarity: 'blue', effect: '+15 к магии, лед', icon: 'ice_staff.png' },
  { name: 'Посох тьмы', rarity: 'purple', effect: '+30 к магии, тьма', icon: 'dark_staff.png' },
  { name: 'Арбалет', rarity: 'green', effect: '+12 к атаке, пробивание', icon: 'crossbow.png' },
  { name: 'Лук охотника', rarity: 'green', effect: '+10 к атаке', icon: 'hunter_bow.png' },
  { name: 'Лук теней', rarity: 'purple', effect: '+22 к атаке, скрытность', icon: 'shadow_bow.png' },
  { name: 'Лук света', rarity: 'yellow', effect: '+40 к атаке, ослепление', icon: 'light_bow.png' },
  { name: 'Золотой меч', rarity: 'yellow', effect: '+35 к атаке, богатство', icon: 'gold_sword.png' },
  { name: 'Клинок дракона', rarity: 'yellow', effect: '+50 к атаке, огонь', icon: 'dragon_blade.png' },
  { name: 'Демонический меч', rarity: 'purple', effect: '+32 к атаке, проклятие', icon: 'demonic_sword.png' },
  { name: 'Молот титана', rarity: 'yellow', effect: '+60 к атаке, оглушение', icon: 'titan_hammer.png' },
  { name: 'Косa смерти', rarity: 'purple', effect: '+35 к атаке, смерть', icon: 'death_scythe.png' },
  { name: 'Кристальный меч', rarity: 'blue', effect: '+18 к атаке, хрупкость', icon: 'crystal_sword.png' },
  { name: 'Обсидиановый клинок', rarity: 'purple', effect: '+28 к атаке, прочность', icon: 'obsidian_blade.png' },
  { name: 'Легендарный меч героя', rarity: 'yellow', effect: '+100 к атаке, святость', icon: 'hero_sword.png' },
];

const armors = [
  { name: 'Тканевая рубашка', rarity: 'gray', effect: '+2 к защите', icon: 'cloth_shirt.png' },
  { name: 'Кожаная броня', rarity: 'green', effect: '+5 к защите', icon: 'leather_armor.png' },
  { name: 'Кольчужный доспех', rarity: 'green', effect: '+8 к защите', icon: 'chainmail.png' },
  { name: 'Железная броня', rarity: 'gray', effect: '+10 к защите', icon: 'iron_armor.png' },
  { name: 'Стальная броня', rarity: 'green', effect: '+15 к защите', icon: 'steel_armor.png' },
  { name: 'Ледяная броня', rarity: 'blue', effect: '+20 к защите, сопротивление льду', icon: 'ice_armor.png' },
  { name: 'Огненная броня', rarity: 'blue', effect: '+20 к защите, сопротивление огню', icon: 'fire_armor.png' },
  { name: 'Теневая броня', rarity: 'purple', effect: '+35 к защите, скрытность', icon: 'shadow_armor.png' },
  { name: 'Святая броня', rarity: 'yellow', effect: '+50 к защите, регенерация', icon: 'holy_armor.png' },
  { name: 'Доспех дракона', rarity: 'yellow', effect: '+60 к защите, иммунитет к огню', icon: 'dragon_armor.png' },
  { name: 'Плащ теней', rarity: 'purple', effect: '+15 к защите, уклонение', icon: 'shadow_cloak.png' },
  { name: 'Плащ мага', rarity: 'blue', effect: '+10 к защите, +20 к мане', icon: 'mage_cloak.png' },
  { name: 'Плащ огня', rarity: 'blue', effect: '+12 к защите, аура огня', icon: 'fire_cloak.png' },
  { name: 'Плащ льда', rarity: 'blue', effect: '+12 к защите, аура льда', icon: 'ice_cloak.png' },
  { name: 'Броня берсерка', rarity: 'purple', effect: '+25 к защите, +15 к атаке', icon: 'berserker_armor.png' },
  { name: 'Броня паладина', rarity: 'yellow', effect: '+55 к защите, святая аура', icon: 'paladin_armor.png' },
  { name: 'Броня ассасина', rarity: 'purple', effect: '+20 к защите, крит. шанс', icon: 'assassin_armor.png' },
  { name: 'Броня стража', rarity: 'green', effect: '+18 к защите, блок', icon: 'guardian_armor.png' },
  { name: 'Броня титана', rarity: 'yellow', effect: '+80 к защите, медлительность', icon: 'titan_armor.png' },
  { name: 'Демоническая броня', rarity: 'purple', effect: '+40 к защите, шипы', icon: 'demonic_armor.png' },
  { name: 'Кристальная броня', rarity: 'blue', effect: '+22 к защите, отражение магии', icon: 'crystal_armor.png' },
  { name: 'Обсидиановая броня', rarity: 'purple', effect: '+45 к защите, неразрушимость', icon: 'obsidian_armor.png' },
  { name: 'Золотая броня', rarity: 'yellow', effect: '+40 к защите, богатство', icon: 'gold_armor.png' },
  { name: 'Броня духа', rarity: 'purple', effect: '+30 к защите, прохождение сквозь стены', icon: 'spirit_armor.png' },
  { name: 'Броня ветра', rarity: 'blue', effect: '+18 к защите, скорость', icon: 'wind_armor.png' },
  { name: 'Броня земли', rarity: 'green', effect: '+20 к защите, стойкость', icon: 'earth_armor.png' },
  { name: 'Броня молнии', rarity: 'blue', effect: '+20 к защите, шок атакующих', icon: 'lightning_armor.png' },
  { name: 'Броня хаоса', rarity: 'purple', effect: '+38 к защите, случайный эффект', icon: 'chaos_armor.png' },
  { name: 'Легендарный доспех героя', rarity: 'yellow', effect: '+100 к защите, все статы +10', icon: 'hero_armor.png' },
  { name: 'Броня бессмертия', rarity: 'yellow', effect: '+120 к защите, возрождение', icon: 'immortality_armor.png' },
];

const potions = [
  { name: 'Зелье здоровья', rarity: 'green', effect: 'Восстанавливает 50 HP', icon: 'health_potion.png' },
  { name: 'Зелье маны', rarity: 'blue', effect: 'Восстанавливает 50 MP', icon: 'mana_potion.png' },
  { name: 'Малое зелье силы', rarity: 'green', effect: '+5 к силе на 10 мин', icon: 'minor_strength_potion.png' },
  { name: 'Зелье скорости', rarity: 'green', effect: '+10 к скорости на 10 мин', icon: 'speed_potion.png' },
  { name: 'Зелье защиты', rarity: 'green', effect: '+10 к защите на 10 мин', icon: 'defense_potion.png' },
  { name: 'Эликсир огня', rarity: 'blue', effect: 'Атаки наносят урон огнем', icon: 'fire_elixir.png' },
  { name: 'Эликсир льда', rarity: 'blue', effect: 'Атаки замораживают', icon: 'ice_elixir.png' },
  { name: 'Эликсир молнии', rarity: 'blue', effect: 'Атаки бьют током', icon: 'lightning_elixir.png' },
  { name: 'Ядовитое зелье', rarity: 'green', effect: 'Отравляет оружие', icon: 'poison_potion.png' },
  { name: 'Тёмный эликсир', rarity: 'purple', effect: '+50 к магии тьмы', icon: 'dark_elixir.png' },
  { name: 'Светлый эликсир', rarity: 'yellow', effect: 'Полное исцеление', icon: 'light_elixir.png' },
  { name: 'Эликсир ярости', rarity: 'purple', effect: '+100% к урону, -50% к защите', icon: 'rage_elixir.png' },
  { name: 'Эликсир невидимости', rarity: 'purple', effect: 'Невидимость на 5 мин', icon: 'invisibility_elixir.png' },
  { name: 'Эликсир удачи', rarity: 'yellow', effect: '+100% шанс крита', icon: 'luck_elixir.png' },
  { name: 'Эликсир опыта', rarity: 'yellow', effect: '+50% получаемого опыта', icon: 'xp_elixir.png' },
  { name: 'Эликсир регенерации', rarity: 'green', effect: 'Восстанавливает 5 HP/сек', icon: 'regen_elixir.png' },
  { name: 'Эликсир энергии', rarity: 'blue', effect: 'Бесконечная выносливость', icon: 'energy_elixir.png' },
  { name: 'Эликсир берсерка', rarity: 'purple', effect: 'Иммунитет к контролю', icon: 'berserker_elixir.png' },
  { name: 'Легендарный эликсир', rarity: 'yellow', effect: 'Все статы +50 на 1 час', icon: 'legendary_elixir.png' },
  { name: 'Эликсир бессмертия', rarity: 'yellow', effect: 'Спасает от смертельного удара', icon: 'immortal_elixir.png' },
];

const books = [
  { name: 'Книга силы', rarity: 'green', effect: 'Навсегда +1 к силе', icon: 'strength_book.png' },
  { name: 'Книга ловкости', rarity: 'green', effect: 'Навсегда +1 к ловкости', icon: 'agility_book.png' },
  { name: 'Книга интеллекта', rarity: 'blue', effect: 'Навсегда +2 к интеллекту', icon: 'intelligence_book.png' },
  { name: 'Книга защиты', rarity: 'green', effect: 'Навсегда +1 к выносливости', icon: 'defense_book.png' },
  { name: 'Книга магии', rarity: 'blue', effect: 'Навсегда +2 к мудрости', icon: 'magic_book.png' },
  { name: 'Книга огня', rarity: 'blue', effect: 'Изучить заклинание: Огненный шар', icon: 'fire_book.png' },
  { name: 'Книга льда', rarity: 'blue', effect: 'Изучить заклинание: Ледяная стрела', icon: 'ice_book.png' },
  { name: 'Книга молнии', rarity: 'blue', effect: 'Изучить заклинание: Цепная молния', icon: 'lightning_book.png' },
  { name: 'Тёмный гримуар', rarity: 'purple', effect: 'Изучить заклинание: Похищение души', icon: 'dark_grimoire.png' },
  { name: 'Священная книга', rarity: 'yellow', effect: 'Изучить заклинание: Воскрешение', icon: 'holy_book.png' },
];

const accessories = [
  { name: 'Амулет силы', rarity: 'green', effect: '+5 к силе', icon: 'strength_amulet.png' },
  { name: 'Кольцо маны', rarity: 'blue', effect: '+50 к мане', icon: 'mana_ring.png' },
  { name: 'Кольцо защиты', rarity: 'green', effect: '+5 к защите', icon: 'defense_ring.png' },
  { name: 'Амулет огня', rarity: 'blue', effect: 'Сопротивление огню 20%', icon: 'fire_amulet.png' },
  { name: 'Амулет льда', rarity: 'blue', effect: 'Сопротивление льду 20%', icon: 'ice_amulet.png' },
  { name: 'Амулет тьмы', rarity: 'purple', effect: 'Сопротивление тьме 50%', icon: 'dark_amulet.png' },
  { name: 'Амулет света', rarity: 'yellow', effect: 'Иммунитет к слепоте', icon: 'light_amulet.png' },
  { name: 'Реликвия древних', rarity: 'purple', effect: 'Все статы +10', icon: 'ancient_relic.png' },
  { name: 'Сердце дракона', rarity: 'yellow', effect: 'Возрождение при смерти', icon: 'dragon_heart.png' },
  { name: 'Легендарный артефакт', rarity: 'yellow', effect: 'Удвоение всех характеристик', icon: 'legendary_artifact.png' },
];

let idCounter = 1;
const allItems = [];

weapons.forEach(w => allItems.push({ id: idCounter++, name: w.name, type: 'weapon', rarity: w.rarity, effect: w.effect, icon: w.icon }));
armors.forEach(a => allItems.push({ id: idCounter++, name: a.name, type: 'armor', rarity: a.rarity, effect: a.effect, icon: a.icon }));
potions.forEach(p => allItems.push({ id: idCounter++, name: p.name, type: 'potion', rarity: p.rarity, effect: p.effect, icon: p.icon }));
books.forEach(b => allItems.push({ id: idCounter++, name: b.name, type: 'book', rarity: b.rarity, effect: b.effect, icon: b.icon }));
accessories.forEach(a => allItems.push({ id: idCounter++, name: a.name, type: 'accessory', rarity: a.rarity, effect: a.effect, icon: a.icon }));

const result = { items: allItems };
fs.writeFileSync('items.json', JSON.stringify(result, null, 2));
