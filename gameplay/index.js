const socket = new ReconnectingWebSocket('ws://' + location.host + '/websocket/v2');
socket.onopen = () => { console.log('Successfully Connected'); };
socket.onclose = event => { console.log('Socket Closed Connection: ', event); socket.send('Client Closed!'); };
socket.onerror = error => { console.log('Socket Error: ', error); };

let starsVisible, bestOf;
let starsRed, starsBlue, nameRed, nameBlue;

socket.onmessage = async event => {
    const data = JSON.parse(event.data);
    if (nameRed !== data.tourney.team.left) {
		nameRed = data.tourney.team.left || 'Red Team';
		$('#red_name').text(nameRed);
	}
	if (nameBlue !== data.tourney.team.right) {
		nameBlue = data.tourney.team.right || 'Blue Team';
		$('#blue_name').text(nameBlue);
	}

    if (starsVisible !== data.tourney.starsVisible) {
		starsVisible = data.tourney.starsVisible;
		if (starsVisible) {
			$('#blue_points').css('opacity', 1);
			$('#red_points').css('opacity', 1);

		} else {
			$('#blue_points').css('opacity', 0);
			$('#red_points').css('opacity', 0);
		}
	}

    if (bestOf !== data.tourney.bestOF) {
		const newmax = Math.ceil(data.tourney.bestOF / 2);
		if (bestOf === undefined) {
			for (let i = 1; i <= newmax; i++) {
				$('#red_points').append($('<div></div>').attr('id', `red${i}`).addClass('team-point red'));
				$('#blue_points').append($('<div></div>').attr('id', `blue${i}`).addClass('team-point blue'));
			}
		}
		else if (bestOf < data.tourney.bestOF) {
			for (let i = firstTo + 1; i <= newmax; i++) {
				$('#red_points').append($('<div></div>').attr('id', `red${i}`).addClass('team-point red'));
				$('#blue_points').append($('<div></div>').attr('id', `blue${i}`).addClass('team-point blue'));
			}
		}
		else {
			for (let i = firstTo; i > newmax; i--) {
				$(`#red${i}`).remove();
				$(`#blue${i}`).remove();
			}
		}
		bestOf = data.tourney.bestOF;
		firstTo = newmax;
	}

    if (starsRed !== data.tourney.points.left) {
		starsRed = data.tourney.points.left;
		for (let i = 1; i <= starsRed; i++) { $(`#red${i}`).addClass('filled'); }
		for (let i = starsRed + 1; i <= firstTo; i++) { $(`#red${i}`).removeClass('filled'); }
	}

	if (starsBlue !== data.tourney.points.right) {
		starsBlue = data.tourney.points.right;
		for (let i = 1; i <= starsBlue; i++) { $(`#blue${i}`).addClass('filled'); }
		for (let i = starsBlue + 1; i <= firstTo; i++) { $(`#blue${i}`).removeClass('filled'); }
	}
    
}