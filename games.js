/* Bora Pro Rolê V5.1 — jogos locais, sem dados de participantes ou partidas no Supabase.
 * Visibilidade controlada por uma única flag pública administrada com MFA via XAMPP.
 * Não possui botões de configuração de jogos nos Squads.
 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const decks = {
    quem: {
      title: 'Quem Sou Eu?', icon:'🕵️', description:'Modo testa: vire a palavra para os outros adivinharem suas pistas.',
      help:'Escolha a categoria, coloque o celular na testa com a tela voltada para a galera e faça perguntas de sim ou não. A palavra gira 180° por padrão; ajuste no botão se precisar.',
      categories: {
        'Famosos brasileiros': ['Anitta','Ivete Sangalo','Fernanda Montenegro','Xuxa','Neymar','Marta','Gilberto Gil','Ludmilla','Sandy','Taís Araújo','Lázaro Ramos','Paulo Gustavo','Marília Mendonça','Ayrton Senna','Pelé','Pabllo Vittar','Carlinhos Brown','Selton Mello','Daniela Mercury','Adriana Esteves'],
        'Famosos internacionais': ['Beyoncé','Taylor Swift','Rihanna','Lady Gaga','Shakira','Adele','Michael Jackson','Madonna','Cristiano Ronaldo','Lionel Messi','Zendaya','Dwayne Johnson','Bruno Mars','Billie Eilish','Selena Gomez','Ed Sheeran','Jennifer Lopez','Tom Holland','Ariana Grande','Will Smith'],
        'Profissões': ['Bombeiro','Médico','Motorista de ônibus','Piloto de avião','Chef de cozinha','Professor','Veterinário','Astronauta','Jornalista','Fotógrafo','Dentista','Mecânico','Bibliotecário','Cientista','Arquiteto','Carteiro','DJ','Salva-vidas','Cabeleireiro','Ator'],
        'Personagens e cultura pop': ['Homem-Aranha','Mulher-Maravilha','Barbie','Shrek','Batman','Harry Potter','Homer Simpson','Wandinha','Mario','Sonic','Mônica','Cebolinha','Darth Vader','Elsa','Peter Pan','Scooby-Doo','Goku','Bob Esponja','Mickey Mouse','Pikachu'],
        'Animais': ['Capivara','Tucano','Golfinho','Leão','Pinguim','Girafa','Elefante','Canguru','Onça-pintada','Coala','Coruja','Polvo','Suricato','Panda','Tartaruga','Camaleão','Lobo-guará','Flamingo','Bicho-preguiça','Arara'],
        'Lugares e objetos': ['Praia','Estádio de futebol','Elevador','Guarda-chuva','Cinema','Aeroporto','Microfone','Geladeira','Roda-gigante','Biblioteca','Bicicleta','Semáforo','Sorveteria','Mochila','Montanha-russa','Chuveiro','Escova de dentes','Museu','Pipoca','Farol']
      }
    },
    nunca: {
      title:'Eu Nunca',icon:'🙈',description:'Histórias leves: conte se quiser, ou simplesmente passe.',
      help:'Leia a frase. Quem quiser pode compartilhar uma história, sem pressão ou exposição. Qualquer participante pode pular.',
      categories:{
        'Rolês e amizades':['Eu nunca perdi a hora de encontrar a galera.','Eu nunca cheguei no rolê vestido para outra ocasião.','Eu nunca fiz amizade esperando na fila.','Eu nunca peguei o ônibus errado para um encontro.','Eu nunca fui a uma festa só pela comida.','Eu nunca cantei karaokê desafinado.','Eu nunca fui ao cinema pela pipoca.','Eu nunca mudei de plano de última hora.','Eu nunca organizei um rolê que virou tradição.','Eu nunca fiz amizade com alguém de outra cidade.','Eu nunca esqueci o nome de alguém recém-apresentado.','Eu nunca terminei uma caminhada em uma cafeteria.'],
        'Cotidiano engraçado':['Eu nunca mandei mensagem no grupo errado.','Eu nunca procurei os óculos enquanto os usava.','Eu nunca falei sozinho durante um filme.','Eu nunca deixei o celular na geladeira.','Eu nunca tropecei na calçada e fingi que era dança.','Eu nunca dormi em uma chamada de vídeo.','Eu nunca ri na hora errada.','Eu nunca dei tchau para alguém que não falava comigo.','Eu nunca saí de casa com meias diferentes.','Eu nunca esqueci por que entrei em um cômodo.'],
        'Música e cultura':['Eu nunca fui a um show sem conhecer as músicas.','Eu nunca decorei uma coreografia de internet.','Eu nunca cantei a letra de uma música errado.','Eu nunca repeti uma série inteira.','Eu nunca chorei assistindo a um filme.','Eu nunca fui a um museu por acaso.','Eu nunca aprendi uma música para impressionar alguém.','Eu nunca fiquei preso em uma música por dias.','Eu nunca participei de uma apresentação improvisada.','Eu nunca comprei ingresso na última hora.']
      }
    },
    escolha:{
      title:'Isso ou Aquilo?',icon:'⚡',description:'Decisões rápidas para descobrir a vibe de cada pessoa.',
      help:'Leia as duas opções e escolha uma. Vale explicar o motivo ou só responder. Não há respostas certas.',
      categories:{
        'Rolês':['Show ou cinema?','Praia ou montanha?','Karaokê ou dança?','Festival ou barzinho?','Passeio de manhã ou à noite?','Viagem planejada ou surpresa?','Cidade grande ou interior?','Pizza em casa ou restaurante?','Parque ou museu?','Rolê pequeno ou festão?'],
        'Comida e rotina':['Doce ou salgado?','Café ou chá?','Pizza ou hambúrguer?','Sorvete ou açaí?','Café da manhã ou jantar?','Cozinhar ou pedir comida?','Chuva ou sol?','Livro ou podcast?','Acordar cedo ou dormir tarde?','Calor ou frio?'],
        'Cultura pop':['Filme ou série?','Comédia ou suspense?','Música ao vivo ou playlist?','Dançar ou cantar?','Cinema ou teatro?','Super-herói ou detetive?','Documentário ou ficção?','Fone de ouvido ou caixa de som?','Clássicos ou lançamentos?','Fotografia ou vídeo?']
      }
    },
    mimica:{
      title:'Mímica',icon:'🎭',description:'Desafios para representar sem falar nem fazer sons.',
      help:'A pessoa que tira a carta representa a ação em silêncio. A galera tenta adivinhar. Use o cronômetro opcional de 60 segundos.',
      categories:{
        'Ações engraçadas':['Perder o ônibus','Tentar abrir um guarda-chuva no vento','Cozinhar macarrão','Dançar com chuva','Perseguir uma borboleta','Montar uma barraca','Procurar sinal no celular','Pegar uma mala muito pesada','Tomar sorvete derretendo','Pular corda'],
        'Profissões':['Barbeiro','Motorista de táxi','Padeiro','Mágico','Pintor','Fotógrafo','Bombeiro','DJ','Dentista','Professor'],
        'Animais':['Pinguim','Canguru','Gato','Caranguejo','Macaco','Elefante','Galinha','Polvo','Gorila','Borboleta']
      }
    },
    desafio:{
      title:'Desafio Relâmpago',icon:'🚀',description:'Missões rápidas e leves, sem humilhar ninguém.',
      help:'Escolha uma missão e faça se estiver confortável. É sempre permitido pular; não registre nem exponha outras pessoas sem autorização.',
      categories:{
        'Criatividade':['Invente o nome de uma banda em 10 segundos.','Crie um slogan divertido para o grupo.','Conte uma história com exatamente cinco palavras.','Fale três usos inusitados para uma colher.','Invente um superpoder totalmente inútil.','Crie um título engraçado para o seu dia.','Dê um nome de filme ao seu último rolê.','Crie uma saudação nova para a galera.','Descreva seu humor usando o nome de uma comida.','Invente uma dança com três movimentos.'],
        'Rir junto':['Imite um apresentador anunciando uma pizza.','Fale como um narrador esportivo por 15 segundos.','Faça uma pose para uma capa de álbum imaginário.','Venda um objeto imaginário em 20 segundos.','Finja que é guia turístico da própria sala.','Explique o Wi-Fi como se fosse uma receita.','Cante uma frase banal como ópera.','Apresente sua melhor risada de vilão.','Faça uma previsão totalmente absurda do tempo.','Conte uma piada que só faça sentido para o grupo.']
      }
    }
  };
  const state = {kind:null,category:null,bag:[],last:null,count:0,flipped:false,remaining:60,timer:null,focus:null,gameHistory:false};
  const overlay = $('bpr-game-overlay');
  if (!overlay) return;
  const safeHTML = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function tiles() {
    return Object.entries(decks).map(([key,g]) =>
      `<button type="button" class="bpr-game-tile" data-bpr-game="${key}"><span aria-hidden="true">${g.icon}</span><strong>${safeHTML(g.title)}</strong><small>${safeHTML(g.description)}</small></button>`
    ).join('');
  }
  const library=$('bpr-global-games');
  if(library) library.innerHTML=tiles();
  function permitted(){return window.BPRGamesAllowed?.() === true;}
  function stopTimer(){if(state.timer){clearInterval(state.timer);state.timer=null;}}
  function updateClock(){const el=$('bpr-game-clock');el.textContent=`${state.remaining} s`;el.classList.remove('hidden');$('bpr-game-timer').textContent=state.timer?'⏸ Pausar tempo':'⏱ '+(state.remaining===60?'Iniciar 60 s':'Continuar tempo');}
  function onClock(){
    if(!permitted()){close();return;}
    state.remaining=Math.max(0,state.remaining-1);updateClock();
    if(!state.remaining){stopTimer();$('bpr-game-play-hint').textContent='⏰ Tempo encerrado! Você pode tirar outra carta ou começar um novo cronômetro.';$('bpr-game-timer').textContent='⏱ Reiniciar 60 s';}
  }
  function chooseCategory(){
    const category=$('bpr-game-category').value;
    if(!decks[state.kind]?.categories[category])return;
    state.category=category;state.bag=[];state.count=0;state.last=null;state.flipped=state.kind==='quem';state.remaining=60;
    $('bpr-game-setup').classList.add('hidden');$('bpr-game-play').classList.remove('hidden');
    $('bpr-game-word').textContent='Pronto pra jogar?';
    $('bpr-game-progress').textContent=category;
    $('bpr-game-next').textContent=state.kind==='quem'?'Revelar palavra':'Revelar carta';
    $('bpr-forehead-card').classList.toggle('is-flipped',state.flipped);
    $('bpr-game-flip').classList.toggle('hidden',state.kind!=='quem');
    $('bpr-game-flip').setAttribute('aria-pressed',String(state.flipped));
    $('bpr-game-clock').classList.add('hidden');$('bpr-game-timer').textContent='⏱ Iniciar 60 s';
    $('bpr-game-play-hint').textContent=state.kind==='quem'?'Vire a tela para os outros antes de revelar. Não olhe a palavra!':'Revele uma carta quando a galera estiver pronta.';
    $('bpr-game-next').focus();
  }
  function next(){
    if(!permitted()){close();return;}
    const items=decks[state.kind]?.categories[state.category];
    if(!items?.length) return;
    if(!state.bag.length){
      const nextBag=[...items];
      for(let i=nextBag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[nextBag[i],nextBag[j]]=[nextBag[j],nextBag[i]];}
      if(nextBag.length>1&&nextBag[nextBag.length-1]===state.last){[nextBag[0],nextBag[nextBag.length-1]]=[nextBag[nextBag.length-1],nextBag[0]];}
      state.bag=nextBag;
    }
    const word=state.bag.pop();state.last=word;state.count++;
    $('bpr-game-word').textContent=word;
    $('bpr-game-progress').textContent=`${state.category} · carta ${state.count}`;
    $('bpr-game-next').textContent='Outra carta →';
    $('bpr-game-play-hint').textContent=state.kind==='quem'?'A galera lê a palavra e dá pistas sem falar o nome.':'Pode pular qualquer carta sem explicar o motivo.';
  }
  function open(kind,origin){
    if(!permitted() || !decks[kind])return;
    stopTimer();state.kind=kind;state.focus=origin||document.activeElement;
    const g=decks[kind];$('bpr-game-title').textContent=`${g.icon} ${g.title}`;
    $('bpr-game-desc').textContent=g.description;
    $('bpr-game-instructions').textContent=g.help;
    $('bpr-game-category').replaceChildren(...Object.keys(g.categories).map(name=>new Option(`${name} · ${g.categories[name].length} cartas`,name)));
    $('bpr-game-setup').classList.remove('hidden');$('bpr-game-play').classList.add('hidden');
    overlay.classList.remove('hidden');overlay.setAttribute('aria-hidden','false');document.body.classList.add('bpr-game-active');
    if(!state.gameHistory){
      history.pushState({...history.state, __bprGame:true}, '', location.href);
      state.gameHistory=true;
    }
    $('bpr-game-category').focus();
  }
  async function close(fromHistory=false){
    if(!fromHistory && state.gameHistory && history.state?.__bprGame){history.back();return;}
    state.gameHistory=false;
    stopTimer();
    if(document.fullscreenElement===overlay){try{await document.exitFullscreen();}catch{}}
    overlay.classList.add('hidden');overlay.setAttribute('aria-hidden','true');document.body.classList.remove('bpr-game-active');
    state.focus?.focus?.();state.kind=null;state.category=null;
  }
  async function fullscreen(){
    try {
      if(document.fullscreenElement===overlay)await document.exitFullscreen();
      else if(overlay.requestFullscreen)await overlay.requestFullscreen();
    } catch { $('bpr-game-play-hint').textContent='O navegador não permitiu tela cheia. O modo ampliado do jogo continua disponível.'; }
  }
  // O botão Voltar do Android fecha somente o jogo; a conversa do Squad permanece aberta.
  window.addEventListener('popstate',event=>{
    if(state.gameHistory && !overlay.classList.contains('hidden') && !event.state?.__bprGame){
      event.stopImmediatePropagation();
      void close(true);
    }
  }, true);
  document.addEventListener('click',event=>{
    const game=event.target.closest('[data-bpr-game]');
    if(game){event.preventDefault();open(game.dataset.bprGame,game);return;}
    const btn=event.target.closest('#bpr-game-overlay [data-game-control]');if(!btn)return;
    event.preventDefault();
    switch(btn.dataset.gameControl){
      case 'close':close();break;
      case 'start':chooseCategory();break;
      case 'next':next();break;
      case 'categories':stopTimer();$('bpr-game-setup').classList.remove('hidden');$('bpr-game-play').classList.add('hidden');$('bpr-game-category').focus();break;
      case 'flip':state.flipped=!state.flipped;$('bpr-forehead-card').classList.toggle('is-flipped',state.flipped);btn.setAttribute('aria-pressed',String(state.flipped));break;
      case 'timer':
        if(state.timer){stopTimer();updateClock();}
        else {if(!state.remaining)state.remaining=60;state.timer=setInterval(onClock,1000);updateClock();}
        break;
      case 'fullscreen':fullscreen();break;
    }
  });
  document.addEventListener('keydown',event=>{
    if(overlay.classList.contains('hidden'))return;
    if(event.key==='Escape'){event.preventDefault();close();return;}
    if(event.key==='ArrowRight'&&!$('bpr-game-play').classList.contains('hidden')){event.preventDefault();next();return;}
    if(event.key==='Tab'){
      const focusable=[...overlay.querySelectorAll('button:not([disabled]),select')].filter(el=>el.getClientRects().length&&el.closest('.hidden')===null);
      if(!focusable.length)return;
      const i=focusable.indexOf(document.activeElement);
      if(event.shiftKey&&i<=0){event.preventDefault();focusable[focusable.length-1].focus();}
      else if(!event.shiftKey&&i===focusable.length-1){event.preventDefault();focusable[0].focus();}
    }
  },true);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.timer){stopTimer();updateClock();}});
  window.BPRGames={tiles,open,close,listGames:()=>Object.keys(decks)};
})();
