const TEAMSIZE = 4;

let mappool, teams;
(async () => {
	$.ajaxSetup({ cache: false });
	mappool = await $.getJSON('../_data/beatmaps.json');
	teams = await $.getJSON('../_data/teams.json');
	let stage = mappool.stage;
	if (stage) $('.stage').text(stage);
})();

let map, mapid;
window.setInterval(async () => {
	await delay(200);
	let cookieName = 'lastPick';
	const match = document.cookie.match(`(?:^|.*)${cookieName}=(.+?)(?:$|[|;].*)`);

	let checkValid = () => {
		if (!mapid) return -9;
		if (match) {
			let cookieValue = match[1].split('-');
			if (cookieValue.length !== 2) return -1;  // expected format: <beatmap_id>-<picking_team>
			const parsedBeatmapID = parseInt(cookieValue[0]);
			if (isNaN(parsedBeatmapID)) return -2;

			// if (true) {  // bypass beatmap id checking during development
			if (mapid == parsedBeatmapID) {
				let map_obj = mappool.beatmaps.find(m => m.beatmap_id == mapid);
				if (map_obj?.identifier?.toUpperCase().includes('TB')) return -3;
				if (nameRed && nameBlue) {
					$('#picked_by').text(`Picked by ${cookieValue[1] === 'red' ? nameRed : nameBlue}`).css('opacity', 1).addClass(cookieValue[1]).removeClass(opposite_team(cookieValue[1]));
					$('#map_slot_container').addClass(cookieValue[1]).removeClass(opposite_team(cookieValue[1]));
					$('#map_image_container').addClass(cookieValue[1]).removeClass(opposite_team(cookieValue[1]));
				}
				else {
					$('#picked_by').text('').css('opacity', 0).removeClass('red blue');
					$('#map_slot_container').removeClass('red blue');
					$('#map_image_container').removeClass('red blue');
				}
				return 0;
			}
			return -255;
		}
	}

	if (checkValid() !== 0) {
		$('#picked_by').text('').css('opacity', 0);
		$('#map_slot_container').removeClass('red blue');
		$('#map_image_container').removeClass('red blue');
	}
}, 500);

let socket = new ReconnectingWebSocket('ws://' + location.host + '/websocket/v2');

let animation = {
	red_score: new CountUp('score_red', 0, 0, 0, .3, { useEasing: true, useGrouping: true, separator: ',', decimal: '.', suffix: '' }),
	blue_score: new CountUp('score_blue', 0, 0, 0, .3, { useEasing: true, useGrouping: true, separator: ',', decimal: '.', suffix: '' }),
	score_diff: new CountUp('score_diff', 0, 0, 0, .3, { useEasing: true, useGrouping: true, separator: ',', decimal: '.', suffix: '' }),
}

socket.onopen = () => { console.log('Successfully Connected'); };
socket.onclose = event => { console.log('Socket Closed Connection: ', event); socket.send('Client Closed!'); };
socket.onerror = error => { console.log('Socket Error: ', error); };

let md5, image;
let scoreVisible, starsVisible, bestOf;
let starsRed, starsBlue, nameRed, nameBlue;
let last_score_update = 0;
let chatLen = 0;

let update_stats = false;
let first_chat_refresh = true;
let timer, blink_timer;
let timer_in_progress = false;

socket.onmessage = async event => {
	const data = JSON.parse(event.data);
	const now = Date.now();

	if (scoreVisible !== data.tourney.scoreVisible) {
		scoreVisible = data.tourney.scoreVisible;

		if (scoreVisible) {
			$('#chat_container').css('opacity', 0);
			$('#top_footer').css('opacity', 1);
		} else {
			$('#chat_container').css('opacity', 1);
			$('#top_footer').css('opacity', 0);
		}
	}

	if (mappool && md5 !== data.beatmap.checksum) {
		md5 = data.beatmap.checksum;
		setTimeout(() => { update_stats = true }, 250);
	}

	if (update_stats) {
		update_stats = false;
		mapid = data.beatmap.id;
		map = mappool ? mappool.beatmaps.find(m => m.beatmap_id == mapid || m.md5 == md5) ?? { id: data.beatmap.id, mods: 'NM', identifier: null } : { id: null, mods: 'NM', identifier: null };
		const mods = map.mods ?? 'NM';
		const stats = getModStats(data.beatmap.stats.cs.original, data.beatmap.stats.ar.original, data.beatmap.stats.od.original, data.beatmap.stats.bpm.common, mods);
		const len_ = data.beatmap.time.lastObject - data.beatmap.time.firstObject;

		$('#cs').text(`cs ${stats.cs}`);
		$('#ar').text(`ar ${stats.ar}`);
		$('#od').text(`od ${stats.od}`);
		$('#bpm').text(`${stats.bpm} bpm`);
		$('#length').text(`${Math.trunc((len_ / stats.speed) / 1000 / 60)}:${Math.trunc((len_ / stats.speed) / 1000 % 60).toString().padStart(2, '0')} length`);
		$('#sr').text(`${data.beatmap.stats.stars.total} stars`);

		$('#title').text(`${data.beatmap.artist} - ${data.beatmap.title} [${data.beatmap.version}]`);
	}

	if (scoreVisible) {
		let scores = [];
		for (let i = 0; i < TEAMSIZE * 2; i++) {
			let score = data.tourney.clients[i]?.play?.score || 0;
			if (data.tourney.clients[i]?.play?.mods?.name?.toUpperCase().includes('EZ')) score *= 1.75;
			scores.push({ id: i, score });
		}

		// scoreRed = 665624;
		// scoreBlue = 796743;
		scoreRed = scores.filter(s => s.id < TEAMSIZE).map(s => s.score).reduce((a, b) => a + b);
		scoreBlue = scores.filter(s => s.id >= TEAMSIZE).map(s => s.score).reduce((a, b) => a + b);
		let scorediff = Math.abs(scoreRed - scoreBlue);

		animation.red_score.update(scoreRed);
		animation.blue_score.update(scoreBlue);
		animation.score_diff.update(scorediff);
		const lead_bar_width = `${Math.max(10, 360 * (Math.min(0.5, Math.pow(scorediff / 1000000, 0.7)) * 2))}px`;

		if (scoreRed > scoreBlue) {
			$('#score_red').addClass('winning');
			$('#score_blue').removeClass('winning');

			if (now - last_score_update > 300) {
				last_score_update = now;
				$('#score_diff').attr('data-before', '◀').attr('data-after', '').css('opacity', 1).addClass('red').removeClass('blue');
				$('#lead_bar').css('width', lead_bar_width).css('right', '960px').css('left', 'unset');
				$('#lead_bar').addClass('red');
				$('#lead_bar').removeClass('blue');
			}
		}
		else if (scoreBlue > scoreRed) {
			$('#score_red').removeClass('winning');
			$('#score_blue').addClass('winning');

			if (now - last_score_update > 300) {
				last_score_update = now;
				$('#score_diff').attr('data-before', '').attr('data-after', '▶').css('opacity', 1).addClass('blue').removeClass('red');
				$('#lead_bar').css('width', lead_bar_width).css('right', 'unset').css('left', '960px');
				$('#lead_bar').removeClass('red');
				$('#lead_bar').addClass('blue');
			}
		}
		else {
			$('#score_diff').attr('data-before', '').attr('data-after', '').css('opacity', 0).removeClass('red').removeClass('blue');
			$('#score_red').removeClass('winning');
			$('#score_blue').removeClass('winning');

			$('#lead_bar').css('width', '0px');
			$('#lead_bar').removeClass('red');
			$('#lead_bar').removeClass('blue');
		}
	}

	if (chatLen !== data.tourney.chat.length) {

		const current_chat_len = data.tourney.chat.length;
		if (chatLen === 0 || (chatLen > 0 && chatLen > current_chat_len)) { $('#chat').html(''); chatLen = 0; }

		for (let i = chatLen; i < current_chat_len; i++) {
			const chat = data.tourney.chat[i];
			const body = chat.message;
			const time = chat.timestamp;

			const team = team_lookup[chat.team] ?? 'unknown';
			const player = chat.name;
			if (player === 'BanchoBot' && body.startsWith('Match history')) continue;

			team_actual = teams.find(t => t.players.map(p => p.username).includes(player))?.team;
			teamcode_actual = team_actual ? team_actual === nameRed ? 'red' : team_actual === nameBlue ? 'blue' : null : null;

			const chatParent = $('<div></div>').addClass(`chat-message ${teamcode_actual ?? team}`);

			chatParent.append($('<div></div>').addClass('chat-time').text(time));
			chatParent.append($('<div></div>').addClass('chat-name').text(player));
			chatParent.append($('<div></div>').addClass('chat-body').text(body));

			$('#chat').prepend(chatParent);
		}

		chatLen = data.tourney.chat.length;
		first_chat_refresh = false;
	}
}

const team_lookup = {
	bot: 'bot',
	left: 'red',
	right: 'blue'
}

const getModStats = (cs_raw, ar_raw, od_raw, bpm_raw, mods) => {
	mods = mods.replace('NC', 'DT');

	let speed = mods.includes('DT') ? 1.5 : mods.includes('HT') ? 0.75 : 1;
	let ar = mods.includes('HR') ? ar_raw * 1.4 : mods.includes('EZ') ? ar_raw * 0.5 : ar_raw;

	let ar_ms = Math.max(Math.min(ar <= 5 ? 1800 - 120 * ar : 1200 - 150 * (ar - 5), 1800), 450) / speed;
	ar = ar < 5 ? (1800 - ar_ms) / 120 : 5 + (1200 - ar_ms) / 150;

	let cs = Math.round(Math.min(mods.includes('HR') ? cs_raw * 1.3 : mods.includes('EZ') ? cs_raw * 0.5 : cs_raw, 10) * 10) / 10;

	let od = mods.includes('HR') ? od_raw * 1.4 : mods.includes('EZ') ? od_raw * 0.5 : od_raw;
	od = Math.round(Math.min((79.5 - Math.min(79.5, Math.max(19.5, 79.5 - Math.ceil(6 * od))) / speed) / 6, 11) * 10) / 10;

	return {
		cs: Math.round(cs * 10) / 10,
		ar: Math.round(ar * 10) / 10,
		od: Math.round(od * 10) / 10,
		bpm: Math.round(bpm_raw * speed * 10) / 10,
		speed
	}
}
