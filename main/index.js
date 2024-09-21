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

let isAcc = () => {
	if (!mapid) return false;
	let map_obj = mappool.beatmaps.find((m) => m.beatmap_id == mapid);
	if (map_obj?.identifier?.toUpperCase().includes("ACC")) return true;
	return false;
};

let socket = new ReconnectingWebSocket('ws://' + location.host + '/websocket/v2');

let acc_animation = {
	red_score: new CountUp("score_red", 0, 0, 2, 0.3, {
	  useEasing: true,
	  useGrouping: true,
	  separator: ",",
	  decimal: ".",
	  suffix: "%",
	}),
	blue_score: new CountUp("score_blue", 0, 0, 2, 0.3, {
	  useEasing: true,
	  useGrouping: true,
	  separator: ",",
	  decimal: ".",
	  suffix: "%",
	}),
	score_diff: new CountUp("score_diff", 0, 0, 2, 0.3, {
	  useEasing: true,
	  useGrouping: true,
	  separator: ",",
	  decimal: ".",
	  suffix: "%",
	}),
};

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
		const mod_enum = calculate_mod_enum(mods);
		const stats = await $.getJSON(`http://${location.host}/api/calculate/pp`, {"mods": mod_enum})
		const len_ = data.beatmap.time.lastObject - data.beatmap.time.firstObject;

		// cs isn't returned by calculate pp endpoint
		const cs_raw = data.beatmap.stats.cs.original
		$('#cs').text(`cs ${Math.round(Math.min(mods.includes('HR') ? cs_raw * 1.3 : mods.includes('EZ') ? cs_raw * 0.5 : cs_raw, 10) * 10) / 10}`);

		$('#ar').text(`ar ${Math.round(stats.difficulty.ar * 10) / 10}`);
		$('#od').text(`od ${Math.round(stats.difficulty.od * 10) / 10}`);

		let length_modifier = map ? (mods?.includes('DT') ? 1.5 : 1) : 1;
		$('#bpm').text(`${Math.round(data.beatmap.stats.bpm.common * length_modifier * 10) / 10} bpm`);

		let mins = Math.trunc((len_ / length_modifier) / 1000 / 60);
		let secs = Math.trunc((len_ / length_modifier) / 1000 % 60);
		$('#length').text(`${mins}:${secs.toString().padStart(2, '0')} length`);
		$('#sr').text(`${Math.round(stats.difficulty.stars * 100) / 100} stars`);

		$('#title').text(`${data.beatmap.artist} - ${data.beatmap.title} [${data.beatmap.version}]`);
	}

	if (scoreVisible) {
		let accMode = isAcc();

		let scores = [];
		for (let i = 0; i < TEAMSIZE * 2; i++) {
			if (accMode) {
				let score = data.tourney.clients[i]?.play?.accuracy || 0;
				if (data.tourney.clients[i]?.play?.playerName === '') {
					score = 0;
				}
        		scores.push({ id: i, score });
			}
			else {
				let score = data.tourney.clients[i]?.play?.score || 0;
				let map_obj = mappool.beatmaps.find(m => m.beatmap_id == mapid);
				let multiplier = 1.0;
				let mods = data.tourney.clients[i]?.play?.mods?.name?.toUpperCase();
				if (!mods.toUpperCase() || mods.toUpperCase() === 'NF') {
					mods = 'NM';
				}
				for (const key in map_obj.multipliers) {
					if (mods.toUpperCase().includes(key)) {
						multiplier *= map_obj.multipliers[key];
					}
				}
				score *= multiplier;
				scores.push({ id: i, score });
			}
		}

		// scoreRed = 665624;
		// scoreBlue = 796743;
		scoreRed = scores.filter(s => s.id < TEAMSIZE).map(s => s.score).reduce((a, b) => a + b);
		scoreBlue = scores.filter(s => s.id >= TEAMSIZE).map(s => s.score).reduce((a, b) => a + b);
		let maxscore = 1000000;
		if (accMode) {
			scoreRed /= TEAMSIZE;
			scoreBlue /= TEAMSIZE;
			maxscore = 100.0;
		}
		let scorediff = Math.abs(scoreRed - scoreBlue);

		let animationMode = accMode ? acc_animation : animation;
		animationMode.red_score.update(scoreRed);
		animationMode.blue_score.update(scoreBlue);
		animationMode.score_diff.update(scorediff);
		const lead_bar_width = `${Math.max(10, 360 * (Math.min(0.5, Math.pow(scorediff / maxscore, 0.7)) * 2))}px`;

		if (scoreRed > scoreBlue) {
			$('#score_red').addClass('winning');
			$('#score_blue').removeClass('winning');

			if (now - last_score_update > 300) {
				last_score_update = now;
				// $('#score_diff').attr('data-before', '◀').attr('data-after', '').css('opacity', 1).addClass('red').removeClass('blue');
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
				// $('#score_diff').attr('data-before', '').attr('data-after', '▶').css('opacity', 1).addClass('blue').removeClass('red');
				$('#lead_bar').css('width', lead_bar_width).css('right', 'unset').css('left', '960px');
				$('#lead_bar').removeClass('red');
				$('#lead_bar').addClass('blue');
			}
		}
		else {
			// $('#score_diff').attr('data-before', '').attr('data-after', '').css('opacity', 0).removeClass('red').removeClass('blue');
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