/* Bora Pro Rolê V6.1 — Central de Jogos: cartas locais, sem salvar respostas/participantes.
 * Um único controle global (BPRGamesAllowed) definido pela Central XAMPP.
 * A disponibilidade também se aplica à Central de Jogos e aos Squads.
 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const decks = {
  "quem": {
    "title": "Quem Sou Eu?",
    "icon": "🕵️",
    "tag": "ADIVINHAÇÃO",
    "description": "A galera dá pistas enquanto você tenta descobrir a carta.",
    "help": "Escolha uma categoria, sorteie uma carta e gire o aparelho para a posição horizontal. Sem texto invertido: a galera lê a carta, você faz perguntas e tenta acertar. Passe a vez quando quiser.",
    "people": "2+",
    "time": "60 s",
    "group": true,
    "categories": {
      "Famosos BR": [
        "Anitta",
        "Ivete Sangalo",
        "Ludmilla",
        "Taís Araújo",
        "Neymar",
        "Marta",
        "Pabllo Vittar",
        "Gilberto Gil",
        "Xuxa",
        "Lázaro Ramos",
        "Paulo Gustavo",
        "Fernanda Montenegro",
        "Glória Pires",
        "Marília Mendonça",
        "Wagner Moura",
        "Sandy",
        "Ayrton Senna",
        "Carlinhos Brown",
        "Fátima Bernardes",
        "Sabrina Sato"
      ],
      "Internacionais": [
        "Beyoncé",
        "Rihanna",
        "Lady Gaga",
        "Taylor Swift",
        "Shakira",
        "Zendaya",
        "Bruno Mars",
        "Billie Eilish",
        "Michael Jackson",
        "Madonna",
        "Adele",
        "Will Smith",
        "Cristiano Ronaldo",
        "Lionel Messi",
        "Ariana Grande",
        "Jennifer Lopez",
        "Dua Lipa",
        "Snoop Dogg",
        "Selena Gomez",
        "The Weeknd"
      ],
      "Filmes e séries": [
        "Titanic",
        "The Last of Us",
        "Round 6",
        "Stranger Things",
        "Vingadores",
        "Barbie",
        "Jurassic Park",
        "Breaking Bad",
        "Harry Potter",
        "La Casa de Papel",
        "Divertida Mente",
        "O Diabo Veste Prada",
        "Avatar",
        "Friends",
        "Shrek",
        "Wandinha"
      ],
      "Personagens": [
        "Mulher-Maravilha",
        "Batman",
        "Homem-Aranha",
        "Goku",
        "Mario",
        "Sonic",
        "Barbie",
        "Shrek",
        "Darth Vader",
        "Wandinha",
        "Homer Simpson",
        "Bob Esponja",
        "Princesa Leia",
        "Mônica",
        "Cebolinha",
        "Wolverine"
      ],
      "Profissões": [
        "DJ",
        "Chef de cozinha",
        "Dentista",
        "Comissário de bordo",
        "Bombeiro",
        "Piloto de avião",
        "Motorista de aplicativo",
        "Arquiteto",
        "Salva-vidas",
        "Jornalista",
        "Fotógrafo",
        "Astronauta",
        "Professor",
        "Tatuador",
        "Barista",
        "Cabeleireiro"
      ],
      "Memes": [
        "Nazaré fazendo contas",
        "Gretchen",
        "Caneta azul",
        "Calabreso",
        "É verdade esse bilete",
        "Luva de Pedreiro",
        "Bora Bill",
        "Carreta Furacão",
        "Gato digitando",
        "Cachorro caramelo",
        "Reação da Nazaré",
        "Meme da Julia Roberts",
        "Tá tranquilo, tá favorável",
        "Que show da Xuxa é esse?"
      ],
      "Objetos e lugares": [
        "Roda-gigante",
        "Pista de dança",
        "Microfone",
        "Torre Eiffel",
        "Praia de Copacabana",
        "Parque Ibirapuera",
        "Cinema",
        "Metrô",
        "Air fryer",
        "Bicicleta",
        "Museu",
        "Fone de ouvido",
        "Sofá",
        "Guarda-chuva"
      ]
    }
  },
  "verdade": {
    "title": "Verdade ou Desafio",
    "icon": "🔥",
    "tag": "SEM ROTEIRO",
    "description": "Perguntas sinceras e desafios para movimentar o grupo.",
    "help": "Escolha um clima e depois Verdade ou Desafio. Qualquer pessoa pode passar sem explicação. Nunca peça senhas, imagens privadas nem coloque alguém em risco.",
    "people": "2+",
    "time": "livre",
    "group": true,
    "categories": {
      "Leve": {
        "truth": [
          "Qual foi o maior mico que você pagou sem querer?",
          "Que desculpa você usa para escapar de um rolê?",
          "Qual foi sua pior compra por impulso?",
          "Quando foi a última vez que você riu na hora errada?",
          "Qual música você canta com uma confiança injustificável?",
          "Qual hábito seu seria motivo de meme?",
          "Que rolê você toparia repetir cem vezes?",
          "Qual foi o encontro mais aleatório que você já teve?"
        ],
        "challenge": [
          "Faça um comercial de 20 segundos para o objeto mais próximo.",
          "Faça uma imitação de celebridade por 30 segundos.",
          "Faça um brinde improvisado como se tivesse ganho um prêmio.",
          "Conte uma história do grupo como narrador de futebol.",
          "Fale com sotaque de personagem por uma rodada.",
          "Invente um nome absurdo para o próximo rolê.",
          "Faça três poses de capa de álbum.",
          "Venda um objeto imaginário para a galera."
        ]
      },
      "Amizade": {
        "truth": [
          "Qual amizade começou do jeito mais improvável?",
          "Quem te conhece melhor e qual mania sua denuncia isso?",
          "Qual foi sua maior vergonha na frente de amigos?",
          "Qual opinião sua sobre a galera mudou com o tempo?",
          "Qual foi a maior furada que virou história boa?",
          "Você já ignorou o grupo e fingiu que não viu?",
          "Qual amizade você gostaria de retomar?"
        ],
        "challenge": [
          "Recrie uma história do grupo em forma de trailer.",
          "Dê um prêmio inventado para cada pessoa que topar brincar.",
          "Descreva o grupo como se fosse uma série.",
          "Faça uma entrevista de 30 segundos com alguém que aceite.",
          "Imite sua reação ao receber um convite de última hora.",
          "Invente um nome para a banda que esse grupo formaria."
        ]
      },
      "Rolê": {
        "truth": [
          "Qual foi o rolê que você quase não foi e amou?",
          "Já fingiu estar chegando quando ainda estava em casa?",
          "Qual foi o maior perrengue na volta para casa?",
          "Você já se arrependeu de um story na manhã seguinte?",
          "Qual lugar você jurou nunca mais voltar?",
          "Qual foi a vez que você entrou no rolê errado?",
          "Já foi a uma festa e ficou só pela comida?"
        ],
        "challenge": [
          "Recrie sua entrada mais vergonhosa em uma festa.",
          "Faça o anúncio de uma balada inventada por 20 segundos.",
          "Imite um DJ com a mesa quebrada.",
          "Descreva o pior rolê como se fosse o melhor do mundo.",
          "Faça uma dança de 15 segundos sem música.",
          "Invente o cardápio de drinks do próximo encontro."
        ]
      },
      "Crush": {
        "truth": [
          "Qual foi a mensagem mais impulsiva que já enviou?",
          "Já teve um crush que ninguém imaginava?",
          "Qual foi o date mais inesperado da sua vida?",
          "Você já fingiu indiferença e se entregou no olhar?",
          "Qual flerte já fez você perder a linha de raciocínio?",
          "Já teve ciúmes sem ter nada com a pessoa?",
          "Qual foi sua maior chance perdida em um encontro?"
        ],
        "challenge": [
          "Crie uma cantada tão ruim que fique boa.",
          "Interprete uma declaração de amor de novela.",
          "Faça uma propaganda de aplicativo de namoro fictício.",
          "Recrie uma cena de flerte de comédia romântica.",
          "Descreva seu date perfeito em dez segundos.",
          "Improvise um pedido de casamento para um objeto."
        ]
      },
      "Picante 18+": {
        "truth": [
          "Já beijou alguém e se arrependeu na mesma noite?",
          "Qual foi a situação de maior tensão romântica que você viveu?",
          "Você já ficou com alguém que conheceu numa festa?",
          "Qual foi o flerte mais descarado que já recebeu?",
          "Já teve vontade de beijar alguém aqui, mas não falou nada?",
          "Você já mandou uma mensagem ousada e apagou?",
          "Já se envolveu com alguém que jurou que era só amizade?",
          "Qual date começou mal e acabou muito bem?"
        ],
        "challenge": [
          "Faça uma cantada adulta sem usar clichês.",
          "Interprete um flerte digno de reality show.",
          "Descreva seu encontro dos sonhos sem citar nomes.",
          "Improvise um convite para sair que seja impossível ignorar.",
          "Recrie uma cena de beijo de novela sem encostar em ninguém.",
          "Escolha uma música para a trilha sonora de um date imaginário."
        ]
      },
      "Sem filtro": {
        "truth": [
          "Que opinião você finge concordar para evitar discussão?",
          "Qual foi a sua pior decisão por impulso?",
          "Qual verdade você demorou demais para admitir a si mesmo?",
          "Já se decepcionou com alguém e nunca contou?",
          "Qual julgamento errado fizeram sobre você?",
          "Qual foi sua maior vergonha em público?",
          "Qual mentira social você usa com frequência?"
        ],
        "challenge": [
          "Conte uma história constrangedora sem citar terceiros.",
          "Faça um monólogo dramático sobre um boleto.",
          "Apresente uma teoria absurda por 30 segundos.",
          "Imite seu próprio jeito de dar desculpas.",
          "Defenda por 20 segundos uma opinião completamente inofensiva e absurda.",
          "Conte uma história real em três atos, sem revelar nomes."
        ]
      }
    }
  },
  "nunca": {
    "title": "Eu Nunca",
    "icon": "🙈",
    "tag": "CONFISSÕES",
    "description": "Histórias, vergonhas e momentos que renderam assunto.",
    "help": "Leia uma afirmação e responda apenas se quiser. Os botões Já fiz / Nunca fiz são locais e não registram respostas. A categoria 18+ é opcional.",
    "people": "2+",
    "time": "rápido",
    "group": true,
    "categories": {
      "Clássico": [
        "Eu nunca inventei uma desculpa para não sair.",
        "Eu nunca cheguei num rolê e quis ir embora na mesma hora.",
        "Eu nunca fui a uma festa só pela comida.",
        "Eu nunca mandei mensagem e me arrependi na mesma hora.",
        "Eu nunca fingi reconhecer alguém.",
        "Eu nunca saí e deixei a chave dentro de casa.",
        "Eu nunca cantei errado achando que sabia a letra.",
        "Eu nunca mudei de opinião no meio da discussão.",
        "Eu nunca fiquei com preguiça de cancelar um compromisso.",
        "Eu nunca voltei atrás depois de dizer que ia embora."
      ],
      "Festas": [
        "Eu nunca apareci numa festa sem conhecer quase ninguém.",
        "Eu nunca perdi meus amigos no meio da balada.",
        "Eu nunca fui ao rolê errado.",
        "Eu nunca fingi estar chegando enquanto saía de casa.",
        "Eu nunca fui o último a sair da festa.",
        "Eu nunca dancei como se ninguém estivesse olhando.",
        "Eu nunca conheci alguém incrível esperando na fila.",
        "Eu nunca acordei sem lembrar o nome de quem conheci.",
        "Eu nunca peguei o transporte errado depois do rolê.",
        "Eu nunca dormi no caminho de volta."
      ],
      "Vergonhas": [
        "Eu nunca dei tchau para alguém que nem estava falando comigo.",
        "Eu nunca mandei áudio para a conversa errada.",
        "Eu nunca stalkeei alguém e curti uma foto antiga.",
        "Eu nunca postei algo e apaguei em segundos.",
        "Eu nunca caí em público e fingi que não foi nada.",
        "Eu nunca fiquei preso numa conversa sem saber como sair.",
        "Eu nunca falei com alguém usando o nome errado.",
        "Eu nunca fui pego cantando sozinho.",
        "Eu nunca ensaiei uma conversa na cabeça.",
        "Eu nunca esqueci o motivo de ter entrado num cômodo."
      ],
      "Relacionamentos": [
        "Eu nunca tive ciúmes sem estar namorando.",
        "Eu nunca inventei uma desculpa para ver um crush.",
        "Eu nunca me apaixonei por uma amizade.",
        "Eu nunca esperei uma pessoa mandar mensagem primeiro.",
        "Eu nunca mandei indireta por story.",
        "Eu nunca achei que era um date e não era.",
        "Eu nunca passei horas escolhendo uma resposta.",
        "Eu nunca tive um encontro tão ruim que virou piada.",
        "Eu nunca silenciei alguém para não criar expectativas.",
        "Eu nunca voltei a conversar com alguém depois de dizer que não voltaria."
      ],
      "Picante 18+": [
        "Eu nunca beijei duas pessoas no mesmo rolê.",
        "Eu nunca fiquei com alguém só depois de muitos olhares.",
        "Eu nunca tive um crush secreto em alguém da galera.",
        "Eu nunca mandei mensagem ousada para a pessoa errada.",
        "Eu nunca fiquei com alguém que conheci na mesma noite.",
        "Eu nunca tive um romance de viagem.",
        "Eu nunca me envolvi com alguém que dizia ser só amigo.",
        "Eu nunca me arrependi de não ter tomado iniciativa.",
        "Eu nunca beijei alguém numa festa e fingi naturalidade.",
        "Eu nunca fui surpreendido por uma química inesperada."
      ],
      "Trabalho e estudos": [
        "Eu nunca fingi entender uma reunião.",
        "Eu nunca perdi o prazo e culpei o Wi-Fi.",
        "Eu nunca estudei tudo na véspera.",
        "Eu nunca chamei o professor pelo nome errado.",
        "Eu nunca mandei a mensagem no grupo errado do trabalho.",
        "Eu nunca usei um feriado para terminar uma tarefa.",
        "Eu nunca ri durante uma apresentação séria.",
        "Eu nunca fiquei com sono na reunião online."
      ],
      "Caótico": [
        "Eu nunca comprei passagem sem conferir a data.",
        "Eu nunca fiz um rolê virar outro completamente diferente.",
        "Eu nunca fugi de uma festa sem me despedir.",
        "Eu nunca combinei dois compromissos no mesmo horário.",
        "Eu nunca aceitei um convite sem saber onde era.",
        "Eu nunca virei meme no grupo.",
        "Eu nunca fui responsável por perder o ônibus da galera.",
        "Eu nunca transformei um passeio simples numa aventura."
      ]
    }
  },
  "escolha": {
    "title": "Isso ou Aquilo?",
    "icon": "⚡",
    "tag": "DUELO DE VIBES",
    "description": "Dois caminhos, uma escolha. Defenda sua vibe.",
    "help": "Toque em uma das opções e conte o motivo, se quiser. O destaque da escolha fica só nesta tela; nada é salvo.",
    "people": "2+",
    "time": "rápido",
    "group": true,
    "categories": {
      "Rolê": [
        "Barzinho com conversa | Balada até amanhecer",
        "Churrasco com a galera | Show lotado",
        "Festa na piscina | Festa na cobertura",
        "Rolê marcado com antecedência | Convite de última hora",
        "Cinema com pipoca | Karaokê com vergonha zero",
        "Pub de rock | Bar de samba",
        "Madrugar na cidade | Nascer do sol na praia",
        "Festival ao ar livre | Show intimista"
      ],
      "Lifestyle": [
        "Viajar com roteiro | Improvisar tudo",
        "Café da manhã demorado | Brunch de domingo",
        "Casa cheia | Poucos amigos",
        "Áudio de três minutos | Mensagem objetiva",
        "Fotos espontâneas | Fotos produzidas",
        "Chuva na janela | Sol na rua",
        "Maratona de série | Noite de jogos",
        "Pedir delivery | Cozinhar junto"
      ],
      "Relacionamento": [
        "Chamar primeiro | Esperar a mensagem",
        "Primeiro date em bar | Primeiro date no parque",
        "Amor à primeira vista | Conexão que cresce",
        "Flerte direto | Troca de olhares",
        "Relacionamento discreto | Fotos juntos no feed",
        "Beijo no primeiro encontro | Deixar acontecer",
        "Surpresa planejada | Viagem a dois improvisada"
      ],
      "Polêmicas leves": [
        "Áudio acelerado | Áudio no normal",
        "Pizza com abacaxi | Pizza sem abacaxi",
        "Sair de fininho | Despedir de todo mundo",
        "Chegar antes | Chegar na hora exata",
        "Ficar sem internet | Ficar sem música",
        "Stories em tempo real | Postar só no dia seguinte",
        "Filme dublado | Filme legendado"
      ],
      "Sem filtro": [
        "Falar o que pensa | Evitar conflito",
        "Sair sem plano | Ficar e descansar",
        "Date excelente sem química | Date caótico com química",
        "Voltar com ex | Nunca mais olhar pra trás",
        "Responder na hora | Demorar de propósito",
        "Ser a alma da festa | Ser quem observa tudo"
      ]
    }
  },
  "mimica": {
    "title": "Mímica",
    "icon": "🎭",
    "tag": "SEM FALAR",
    "description": "Ação, cinema, memes e caos — tudo na base da atuação.",
    "help": "Sorteie uma carta, mostre-a apenas a quem vai atuar e comece o cronômetro. A pessoa representa sem falar. Vale pular sem penalidade.",
    "people": "2+",
    "time": "60 s",
    "group": true,
    "categories": {
      "Filmes": [
        "Titanic",
        "Barbie",
        "Jurassic Park",
        "O Rei Leão",
        "Velozes e Furiosos",
        "Matrix",
        "Harry Potter",
        "Star Wars",
        "Divertida Mente",
        "Esqueceram de Mim",
        "Frozen",
        "Shrek",
        "O Diabo Veste Prada",
        "Homem-Aranha",
        "Avatar"
      ],
      "Séries": [
        "Round 6",
        "Friends",
        "Stranger Things",
        "La Casa de Papel",
        "The Last of Us",
        "Wandinha",
        "Breaking Bad",
        "The Office",
        "Grey’s Anatomy",
        "Game of Thrones",
        "Brooklyn Nine-Nine",
        "The Boys"
      ],
      "Memes": [
        "Nazaré fazendo contas",
        "Cachorro caramelo fugindo",
        "Gato julgando a galera",
        "Carreta Furacão dançando",
        "Luva de Pedreiro",
        "Alguém abrindo o boleto",
        "Pessoa tentando segurar o riso",
        "Alguém caindo na trend errado",
        "Gato derrubando um copo",
        "Pessoa respondendo “eu avisei”",
        "Amigo fingindo não ouvir o chamado",
        "Apresentador de reality anunciando eliminação"
      ],
      "Celebridades": [
        "Anitta",
        "Beyoncé",
        "Xuxa",
        "Lady Gaga",
        "Neymar",
        "Rihanna",
        "Ivete Sangalo",
        "Cristiano Ronaldo",
        "Taylor Swift",
        "Madonna",
        "Paulo Gustavo",
        "Shakira"
      ],
      "Profissões": [
        "DJ",
        "Dentista",
        "Professor",
        "Fotógrafo",
        "Chef de cozinha",
        "Bombeiro",
        "Piloto de avião",
        "Tatuador",
        "Motorista de ônibus",
        "Salva-vidas",
        "Garçom",
        "Jornalista"
      ],
      "Objetos": [
        "Air fryer",
        "Guarda-chuva quebrado",
        "Secador de cabelo",
        "Controle remoto sem pilha",
        "Cadeira de praia",
        "Fone com fio embolado",
        "Mala pesada",
        "Ventilador",
        "Câmera fotográfica",
        "Bicicleta ergométrica",
        "Máquina de lavar",
        "Selfie stick"
      ],
      "Bagunça total": [
        "Cair na pista de dança e disfarçar",
        "Tentar abrir um guarda-chuva no vento",
        "Correr atrás do ônibus",
        "Ser famoso e evitar paparazzi",
        "Dançar com sapato apertado",
        "Perder a chave de casa",
        "Ser atacado por mosquitos",
        "Encarar uma barata voadora",
        "Pegar o elevador errado",
        "Tentar fazer uma live sem sinal"
      ]
    }
  },
  "stop": {
    "title": "Stop!",
    "icon": "⏱️",
    "tag": "A VELOCIDADE CONTA",
    "description": "Letra sorteada, categorias definidas e disputa de raciocínio.",
    "help": "Uma pessoa sorteia a letra. Todo mundo escreve suas respostas no papel ou fora do app. Quem terminar grita STOP! Este jogo não registra respostas nem pontuações.",
    "people": "2+",
    "time": "60 s",
    "group": true,
    "categories": {
      "Clássico": [
        "Letra A · nome, cidade, comida e objeto",
        "Letra B · nome, cidade, comida e objeto",
        "Letra C · nome, cidade, comida e objeto",
        "Letra D · nome, cidade, comida e objeto",
        "Letra E · nome, cidade, comida e objeto",
        "Letra F · nome, cidade, comida e objeto",
        "Letra G · nome, cidade, comida e objeto",
        "Letra H · nome, cidade, comida e objeto",
        "Letra J · nome, cidade, comida e objeto",
        "Letra L · nome, cidade, comida e objeto",
        "Letra M · nome, cidade, comida e objeto",
        "Letra N · nome, cidade, comida e objeto",
        "Letra P · nome, cidade, comida e objeto",
        "Letra R · nome, cidade, comida e objeto",
        "Letra S · nome, cidade, comida e objeto",
        "Letra T · nome, cidade, comida e objeto",
        "Letra V · nome, cidade, comida e objeto"
      ],
      "Do rolê": [
        "Letra A · música, artista, filme e lugar para sair",
        "Letra B · música, artista, filme e lugar para sair",
        "Letra C · música, artista, filme e lugar para sair",
        "Letra F · música, artista, filme e lugar para sair",
        "Letra L · música, artista, filme e lugar para sair",
        "Letra M · música, artista, filme e lugar para sair",
        "Letra P · música, artista, filme e lugar para sair",
        "Letra R · música, artista, filme e lugar para sair",
        "Letra S · música, artista, filme e lugar para sair",
        "Letra T · música, artista, filme e lugar para sair"
      ],
      "Sem filtro": [
        "Letra A · meme, desculpa, gíria e celebridade",
        "Letra B · meme, desculpa, gíria e celebridade",
        "Letra C · meme, desculpa, gíria e celebridade",
        "Letra F · meme, desculpa, gíria e celebridade",
        "Letra M · meme, desculpa, gíria e celebridade",
        "Letra P · meme, desculpa, gíria e celebridade",
        "Letra S · meme, desculpa, gíria e celebridade"
      ]
    }
  },
  "desafio": {
    "title": "Desafio Relâmpago",
    "icon": "🚀",
    "tag": "A VEZ É SUA",
    "description": "Missões criativas para animar o grupo em segundos.",
    "help": "Uma missão por vez. Ninguém precisa participar nem publicar nada na internet. Evite envolver pessoas que não aceitaram brincar.",
    "people": "2+",
    "time": "30 s",
    "group": true,
    "categories": {
      "Improviso": [
        "Venda um objeto imaginário por 20 segundos.",
        "Imite um locutor de rádio anunciando o próximo rolê.",
        "Faça uma declaração dramática de amor a uma pizza.",
        "Dê um nome absurdo para a banda do grupo.",
        "Apresente um reality show sobre sua última semana.",
        "Crie uma previsão do tempo para o humor da galera.",
        "Interprete um apresentador de programa de auditório.",
        "Faça um pitch de 30 segundos para uma invenção inútil."
      ],
      "Rolê": [
        "Crie uma coreografia de 15 segundos.",
        "Invente um lema para a próxima festa.",
        "Apresente uma atração surpresa totalmente fictícia.",
        "Faça uma imitação de DJ sem música.",
        "Descreva um ônibus lotado como um passeio de luxo.",
        "Dê um prêmio fictício para o melhor anfitrião.",
        "Recrie o final de um rolê que saiu do controle.",
        "Transforme uma história da galera em manchete."
      ],
      "Caos criativo": [
        "Interprete um vilão tentando pagar o aluguel.",
        "Faça um discurso de vitória por ter achado a chave.",
        "Defenda um objeto comum como se fosse revolucionário.",
        "Invente uma novela em três frases.",
        "Faça sua melhor risada de antagonista.",
        "Explique uma rede social como se fosse receita culinária.",
        "Imite um elevador quebrado.",
        "Narre uma dança como se fosse final de campeonato."
      ]
    }
  },
  "provavel": {
    "title": "Quem é mais provável?",
    "icon": "👀",
    "tag": "A GALERA DECIDE",
    "description": "Perguntas rápidas para descobrir quem combina com cada situação.",
    "help": "Leia a situação e aponte para alguém que esteja participando e aceite a brincadeira. Nada é registrado. Evite expor ou pressionar qualquer pessoa.",
    "people": "3+",
    "time": "rápido",
    "group": true,
    "categories": {
      "Rolês": [
        "Quem é mais provável de marcar o rolê e chegar atrasado?",
        "Quem é mais provável de fazer amizade com a mesa ao lado?",
        "Quem é mais provável de virar DJ da festa sem ser convidado?",
        "Quem é mais provável de desaparecer na pista e voltar com uma história?",
        "Quem é mais provável de achar o melhor bar barato da cidade?",
        "Quem é mais provável de querer estender a noite?",
        "Quem é mais provável de organizar tudo numa planilha?",
        "Quem é mais provável de cantar karaokê sem saber a letra?"
      ],
      "Vida real": [
        "Quem é mais provável de mandar áudio de cinco minutos?",
        "Quem é mais provável de esquecer onde deixou o celular?",
        "Quem é mais provável de conseguir um emprego por acaso?",
        "Quem é mais provável de viralizar sem querer?",
        "Quem é mais provável de ter 37 abas abertas no navegador?",
        "Quem é mais provável de se atrasar para a própria festa?",
        "Quem é mais provável de começar um hobby inusitado?",
        "Quem é mais provável de fazer amizade numa viagem?"
      ],
      "Amizades": [
        "Quem é mais provável de ouvir todos os desabafos?",
        "Quem é mais provável de puxar um reencontro?",
        "Quem é mais provável de ter a melhor playlist?",
        "Quem é mais provável de lembrar o aniversário de todo mundo?",
        "Quem é mais provável de fazer uma surpresa?",
        "Quem é mais provável de contar a história mais engraçada?",
        "Quem é mais provável de encontrar solução para um perrengue?",
        "Quem é mais provável de transformar um grupo em família?"
      ]
    }
  }
};
  const overlay = $('bpr-game-overlay');
  if (!overlay) return;
  const safeHTML = s => String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const permitted = () => window.BPRGamesAllowed?.() === true;
  const state = {kind:null,category:null,mode:'truth',filter:'todos',bag:[],last:null,count:0,remaining:60,duration:60,timer:null,deadline:0,lastTick:-1,audio:null,focus:null,gameHistory:false,forehead:false,responded:false};
  // Efeitos originais sintetizados localmente (sem arquivos/licenças externas).
  let soundOn=true;
  try{soundOn=localStorage.getItem('bpr-games-sound')!=='off';}catch{}
  function soundButtons(){document.querySelectorAll('[data-game-control="sound"]').forEach(btn=>{btn.textContent=soundOn?'🔊 Sons ligados':'🔇 Sons desligados';btn.setAttribute('aria-pressed',String(soundOn));});}
  function audioReady(){
    if(!soundOn)return null;
    try {const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;
      state.audio ||= new C();if(state.audio.state==='suspended')void state.audio.resume().catch(()=>{});
      return state.audio;
    }catch{return null;}
  }
  function gameTone(frequency,seconds=0.1,delay=0,shape='sine',level=.035){
    const a=audioReady();if(!a||a.state==='closed')return;
    try {const osc=a.createOscillator(), gain=a.createGain(),at=a.currentTime+delay;
      osc.type=shape;osc.frequency.setValueAtTime(frequency,at);gain.gain.setValueAtTime(.001,at);
      gain.gain.exponentialRampToValueAtTime(Math.max(.002,level),at+.012);
      gain.gain.exponentialRampToValueAtTime(.001,at+seconds);
      osc.connect(gain);gain.connect(a.destination);osc.start(at);osc.stop(at+seconds+.025);
    }catch{}
  }
  function gameSound(type,remaining=0){
    if(!soundOn)return;
    if(type==='card'){
      gameTone(440,.10,0,'sine',.025);
      gameTone(660,.11,.09,'triangle',.029);
      gameTone(880,.13,.18,'sine',.02);
    } else if(type==='start'){
      [420,560,840].forEach((freq,i)=>gameTone(freq,.11,i*.12,'triangle',.035));
    } else if(type==='tick'){
      // Tiques de contagem acelerados no final, suaves e variados.
      gameTone(720+(5-Math.min(5,remaining))*55,.07,0,'triangle',.028);
      if(remaining<=3)gameTone(390,.045,.075,'sine',.022);
    } else if(type==='end'){
      // Explosão cômica arcade: queda de tom + ruído filtrado + brilho final.
      const a=audioReady();if(!a)return;
      try{
        const now=a.currentTime;
        const master=a.createDynamicsCompressor();
        master.threshold.value=-18;master.ratio.value=5;
        const vol=a.createGain();vol.gain.value=.13;
        master.connect(vol);vol.connect(a.destination);
        const sweep=a.createOscillator(),sweepGain=a.createGain();
        sweep.type='sawtooth';sweep.frequency.setValueAtTime(290,now);
        sweep.frequency.exponentialRampToValueAtTime(42,now+.65);
        sweepGain.gain.setValueAtTime(.001,now);
        sweepGain.gain.exponentialRampToValueAtTime(.42,now+.045);
        sweepGain.gain.exponentialRampToValueAtTime(.001,now+.7);
        sweep.connect(sweepGain);sweepGain.connect(master);
        sweep.start(now);sweep.stop(now+.71);
        const length=Math.floor(a.sampleRate*.48),buff=a.createBuffer(1,length,a.sampleRate),data=buff.getChannelData(0);
        for(let i=0;i<length;i++){const env=Math.pow(1-i/length,2);data[i]=(Math.random()*2-1)*env;}
        const src=a.createBufferSource(),filter=a.createBiquadFilter(),ng=a.createGain();
        src.buffer=buff;filter.type='lowpass';filter.frequency.setValueAtTime(3300,now);
        filter.frequency.exponentialRampToValueAtTime(280,now+.45);
        ng.gain.setValueAtTime(.24,now);ng.gain.exponentialRampToValueAtTime(.001,now+.47);
        src.connect(filter);filter.connect(ng);ng.connect(master);src.start(now);src.stop(now+.49);
        [0,.12,.24].forEach((delay,i)=>gameTone(650+i*150,.08,.67+delay,'triangle',.023));
      }catch{}
    }
  }
  soundButtons();

  const categories = kind => decks[kind]?.categories || {};
  const hasAdult = game => Object.keys(game.categories).some(k => k.includes('18+'));
  const gameKeys = Object.keys(decks);
  function tiles(filter='todos') {
    return gameKeys.filter(key=>{
      const g=decks[key];
      return filter==='todos' || (filter==='grupo'&&g.group) || (filter==='rapidos'&&(g.time==='rápido'||g.time==='30 s')) || (filter==='adulto'&&hasAdult(g));
    }).map(key=>{
      const g=decks[key];
      return `<button type="button" class="bpr-game-tile bpr-v61-tile" data-bpr-game="${key}" aria-label="Abrir ${safeHTML(g.title)}">
       <span class="bpr-v61-tile-icon" aria-hidden="true">${g.icon}</span>
       <span class="bpr-v61-tile-tag">${safeHTML(g.tag)}</span>
       <strong>${safeHTML(g.title)}</strong><small>${safeHTML(g.description)}</small>
       <span class="bpr-v61-tile-footer"><span>👥 ${safeHTML(g.people)}</span><span>⏱ ${safeHTML(g.time)}</span><b>Jogar →</b></span></button>`;
    }).join('');
  }
  function updateLibrary(){const lib=$('bpr-global-games');if(lib)lib.innerHTML=tiles(state.filter);}
  updateLibrary();
  function stopTimer(){if(state.timer){clearInterval(state.timer);state.timer=null;}state.deadline=0;}
  function clockUpdate(){
    const clock=$('bpr-game-clock');if(!clock)return;
    const num=$('bpr-v63-clock-number'),label=$('bpr-v63-clock-label');
    clock.classList.remove('hidden');num.textContent=String(state.remaining);
    clock.style.setProperty('--clock-progress',`${Math.max(0,state.remaining/state.duration)*100}%`);
    clock.classList.toggle('is-ending',state.remaining<=10);
    clock.classList.toggle('is-finished',state.remaining===0);
    label.textContent=state.remaining===0?'💥 TEMPO ESGOTADO!':state.timer?'⏱ Rodada em andamento':state.remaining===state.duration?'▶ Pronto para começar':'⏸ Cronômetro pausado';
    $('bpr-game-timer').textContent=state.timer?'⏸ Pausar':state.remaining===0?`↻ Reiniciar ${state.duration}s`:`▶ ${state.remaining===state.duration?'Iniciar':'Continuar'} ${state.remaining}s`;
  }
  function tick(){
    if(!permitted()){void close();return;}
    if(!state.deadline)return;
    const next=Math.max(0,Math.ceil((state.deadline-Date.now())/1000));
    if(next!==state.remaining){state.remaining=next;clockUpdate();if(next>0&&next<=5)gameSound('tick',next);}
    if(!next){stopTimer();clockUpdate();gameSound('end');$('bpr-game-play-hint').textContent='💥 Tempo! Escolha outra carta ou recomece a rodada.';}
  }
  function resetTimer(){stopTimer();state.remaining=state.duration;state.lastTick=-1;$('bpr-game-clock').classList.add('hidden');$('bpr-game-clock').classList.remove('is-ending','is-finished');$('bpr-game-timer').textContent=`▶ Iniciar ${state.duration}s`;}
  function setCategory(category){
    if(!categories(state.kind)[category]) return;
    stopTimer();state.category=category;state.mode='truth';state.bag=[];state.last=null;state.count=0;
    $('bpr-game-category').value=category;
    renderChips();
  }
  function renderChips(){
    const target=$('bpr-game-category-chips');if(!target)return;
    target.innerHTML=Object.keys(categories(state.kind)).map(name=>`<button type="button" data-game-category="${safeHTML(name)}" class="bpr-v61-chip${name===state.category?' is-selected':''}" aria-pressed="${name===state.category}">${safeHTML(name)}</button>`).join('');
  }
  function chooseCategory(){
    const category=$('bpr-game-category').value;
    if(!categories(state.kind)[category])return;
    setCategory(category); resetTimer(); state.forehead=false;state.responded=false;
    $('bpr-game-setup').classList.add('hidden');$('bpr-game-play').classList.remove('hidden');
    $('bpr-game-progress').textContent=`${category} · pronta para a rodada`;
    $('bpr-game-word').textContent='Sua próxima carta aparece aqui';
    $('bpr-game-next').textContent=state.kind==='quem'?'🎲 Sortear carta':'🎲 Revelar carta';
    $('bpr-game-play-hint').textContent=state.kind==='quem'?'Gire o celular na horizontal. Passe a tela para a galera antes de sortear.':'Jogue no seu ritmo. Qualquer pessoa pode passar.';
    overlay.classList.toggle('bpr-v61-who',state.kind==='quem');
    overlay.classList.remove('bpr-v61-forehead');
    $('bpr-game-forehead').classList.toggle('hidden',state.kind!=='quem');
    $('bpr-game-fullscreen').classList.toggle('hidden',state.kind!=='quem'&&state.kind!=='mimica');$('bpr-game-fullscreen').textContent='⛶ Ampliar jogo';$('bpr-game-fullscreen').setAttribute('aria-pressed','false');
    $('bpr-game-vote').classList.add('hidden');$('bpr-game-mode').classList.toggle('hidden',state.kind!=='verdade');
    renderMode(); $('bpr-game-next').focus();
  }
  function renderMode(){
    $('bpr-game-mode').querySelectorAll('[data-game-mode]').forEach(b=>{
      const on=b.dataset.gameMode===state.mode;
      b.classList.toggle('is-selected',on);b.setAttribute('aria-pressed',String(on));
    });
    if(state.kind==='verdade')$('bpr-game-mode-hint').textContent=state.mode==='truth'?'Uma pergunta para responder, se quiser.':'Um desafio que qualquer pessoa pode pular.';
  }
  function shuffled(items){
    const arr=[...items];for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}
    if(arr.length>1&&arr[arr.length-1]===state.last){[arr[0],arr[arr.length-1]]=[arr[arr.length-1],arr[0]];}
    return arr;
  }
  function next(){
    if(!permitted()){void close();return;}
    const collection=categories(state.kind)[state.category];
    const items=state.kind==='verdade'?collection?.[state.mode]:collection;
    if(!items?.length)return;
    if(!state.bag.length)state.bag=shuffled(items);
    const word=state.bag.pop();state.last=word;state.count++;state.responded=false;
    const card=$('bpr-forehead-card');card.classList.toggle('bpr-v61-versus',state.kind==='escolha');
    const wordNode=$('bpr-game-word');
    if(state.kind==='escolha'){
      const parts=word.split(' | ');
      wordNode.textContent='';
      const first=document.createElement('span');first.className='bpr-v61-option';first.textContent=parts[0];
      const vs=document.createElement('span');vs.className='bpr-v61-vs';vs.textContent='VS';
      const second=document.createElement('span');second.className='bpr-v61-option';second.textContent=parts[1]||'Outra opção';
      wordNode.append(first,vs,second);
    } else wordNode.textContent=word;
    $('bpr-game-progress').textContent=`${state.category} · carta ${state.count}`;
    $('bpr-game-next').textContent='↻ Nova carta';
    $('bpr-game-play-hint').textContent=state.kind==='quem'?'Mostre esta carta para a galera e tente adivinhar com perguntas de sim ou não.':
      state.kind==='mimica'?'Quem vai atuar lê esta carta; depois a galera tenta adivinhar.':
      state.kind==='escolha'?'Qual lado você escolheria? Vale defender sua escolha.':
      'Não precisa responder nem completar desafios que causem desconforto.';
    const vote=$('bpr-game-vote'); vote.classList.toggle('hidden',state.kind!=='nunca');
    vote.querySelectorAll('button').forEach(b=>{b.classList.remove('is-selected');b.setAttribute('aria-pressed','false');});
    card.classList.add('is-revealed');gameSound('card');
  }
  function open(kind,origin){
    if(!permitted()||!decks[kind])return;
    stopTimer();state.kind=kind;state.focus=origin||document.activeElement;state.forehead=false;state.count=0;
    soundButtons();const g=decks[kind];$('bpr-game-title').textContent=`${g.icon} ${g.title}`;$('bpr-game-desc').textContent=g.description;
    $('bpr-game-instructions').textContent=g.help;
    const names=Object.keys(g.categories);
    $('bpr-game-category').replaceChildren(...names.map(name=>new Option(`${name} · ${g.categories[name]?.truth ? g.categories[name].truth.length + g.categories[name].challenge.length : g.categories[name].length} cartas`,name)));
    setCategory(names[0]); resetTimer();
    $('bpr-game-setup').classList.remove('hidden');$('bpr-game-play').classList.add('hidden');
    $('bpr-game-setup').classList.toggle('bpr-v61-has-modes',kind==='verdade');
    overlay.classList.remove('bpr-v61-forehead','bpr-v61-who','bpr-v65-immersive');
    overlay.classList.remove('hidden');overlay.setAttribute('aria-hidden','false');document.body.classList.add('bpr-game-active');
    if(!state.gameHistory){history.pushState({...history.state,__bprGame:true},'',location.href);state.gameHistory=true;}
    $('bpr-game-category').focus();
  }
  async function close(fromHistory=false){
    if(!fromHistory&&state.gameHistory&&history.state?.__bprGame){history.back();return;}
    state.gameHistory=false;stopTimer();
    try{if(document.fullscreenElement===overlay)await document.exitFullscreen();}catch{}
    try{screen.orientation?.unlock?.();}catch{}
    overlay.classList.add('hidden');overlay.setAttribute('aria-hidden','true');overlay.classList.remove('bpr-v61-forehead','bpr-v61-who','bpr-v65-immersive');document.body.classList.remove('bpr-game-active');
    state.focus?.focus?.();state.kind=null;state.category=null;
  }
  async function fullscreen(landscape=false){
    // Modo imersivo interno. Evita o aviso nativo do navegador mostrando a origem GitHub.
    // Não promete ocultar barras do sistema ou forçar orientação em navegadores móveis.
    if($('bpr-game-clock')?.classList.contains('hidden'))clockUpdate();
    const enabled=overlay.classList.toggle('bpr-v65-immersive');
    $('bpr-game-fullscreen').textContent=enabled?'↩ Voltar ao layout':'⛶ Ampliar jogo';
    $('bpr-game-fullscreen').setAttribute('aria-pressed',String(enabled));
    if(enabled&&landscape)$('bpr-game-play-hint').textContent='Se possível, gire o celular. A carta e o cronômetro ficam juntos.';
  }
  document.addEventListener('fullscreenchange',()=>{
    if(document.fullscreenElement!==overlay && !state.forehead)overlay.classList.remove('bpr-v65-immersive');
  });
  window.addEventListener('popstate',e=>{if(state.gameHistory&&!overlay.classList.contains('hidden')&&!e.state?.__bprGame){e.stopImmediatePropagation();void close(true);}},true);
  document.addEventListener('click',event=>{
    const filter=event.target.closest('[data-games-filter]');if(filter){state.filter=filter.dataset.gamesFilter;document.querySelectorAll('[data-games-filter]').forEach(b=>{const active=b===filter;b.classList.toggle('is-selected',active);b.setAttribute('aria-pressed',String(active));});updateLibrary();return;}
    const game=event.target.closest('[data-bpr-game]');if(game){event.preventDefault();open(game.dataset.bprGame,game);return;}
    if(overlay.classList.contains('hidden'))return;
    const cat=event.target.closest('[data-game-category]');if(cat){event.preventDefault();setCategory(cat.dataset.gameCategory);return;}
    const mode=event.target.closest('[data-game-mode]');if(mode){event.preventDefault();state.mode=mode.dataset.gameMode;state.bag=[];state.count=0;state.last=null;renderMode();$('bpr-game-word').textContent='Pronto para sortear';$('bpr-game-next').textContent='🎲 Sortear carta';$('bpr-game-progress').textContent=`${state.category} · ${state.mode==='truth'?'Verdade':'Desafio'}`;return;}
    const vote=event.target.closest('[data-game-vote]');if(vote){event.preventDefault();$('bpr-game-vote').querySelectorAll('[data-game-vote]').forEach(b=>{const selected=b===vote;b.classList.toggle('is-selected',selected);b.setAttribute('aria-pressed',String(selected));});return;}
    const btn=event.target.closest('#bpr-game-overlay [data-game-control]');if(!btn)return;
    event.preventDefault();switch(btn.dataset.gameControl){
      case 'close':void close();break;
      case 'start':chooseCategory();break;
      case 'next':next();break;
      case 'categories':stopTimer();overlay.classList.remove('bpr-v61-forehead');$('bpr-game-setup').classList.remove('hidden');$('bpr-game-play').classList.add('hidden');$('bpr-game-category').focus();break;
      case 'forehead':state.forehead=!state.forehead;overlay.classList.toggle('bpr-v61-forehead',state.forehead);if(!state.forehead&&document.fullscreenElement!==overlay)overlay.classList.remove('bpr-v65-immersive');btn.setAttribute('aria-pressed',String(state.forehead));btn.textContent=state.forehead?'↩ Sair do modo testa':'📱 Modo testa horizontal';$('bpr-game-play-hint').textContent=state.forehead?'Gire o celular para o modo paisagem e mostre a carta para a galera. A palavra nunca fica invertida.':'Modo normal: compartilhe a tela para quem vai dar as pistas.';if(state.forehead && !overlay.classList.contains('bpr-v65-immersive'))void fullscreen(true);break;
      case 'timer':if(state.timer){const remain=Math.max(0,Math.ceil((state.deadline-Date.now())/1000));stopTimer();state.remaining=remain;clockUpdate();}else{if(!state.remaining)state.remaining=state.duration;state.deadline=Date.now()+state.remaining*1000;state.timer=setInterval(tick,120);gameSound('start');clockUpdate();}break;
      case 'sound':soundOn=!soundOn;try{localStorage.setItem('bpr-games-sound',soundOn?'on':'off');}catch{}soundButtons();if(soundOn)gameSound('card');break;
      case 'fullscreen':void fullscreen(state.kind==='quem');break;
    }
  });
  $('bpr-game-category').addEventListener('change',e=>setCategory(e.target.value));
  $('bpr-game-duration').addEventListener('change',e=>{state.duration=Number(e.target.value)||60;resetTimer();});
  document.addEventListener('keydown',event=>{
    if(overlay.classList.contains('hidden'))return;
    if(event.key==='Escape'){event.preventDefault();void close();return;}
    if(event.key==='ArrowRight'&&!$('bpr-game-play').classList.contains('hidden')&&!['SELECT','BUTTON'].includes(document.activeElement?.tagName)){event.preventDefault();next();return;}
    if(event.key==='Tab'){
      const focusable=[...overlay.querySelectorAll('button:not([disabled]),select')].filter(el=>el.getClientRects().length&&el.closest('.hidden')===null);
      if(!focusable.length)return;const i=focusable.indexOf(document.activeElement);
      if(event.shiftKey&&i<=0){event.preventDefault();focusable[focusable.length-1].focus();}
      else if(!event.shiftKey&&i===focusable.length-1){event.preventDefault();focusable[0].focus();}
    }
  },true);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.timer){stopTimer();clockUpdate();}});
  window.BPRGames={tiles:()=>tiles('todos'),open,close,listGames:()=>gameKeys.slice()};
})();
