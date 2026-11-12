import type { NomeIcone } from '@/components/icone';

/**
 * Microtreinamentos. A ORDEM das opções importa: o gabarito fica no banco
 * (função concluir_treinamento) e usa o índice de cada resposta (0, 1, 2…).
 */
export type Pergunta = { texto: string; opcoes: string[] };
export type Modulo = { id: 'atendimento' | 'higiene' | 'bebida' | 'seguranca'; titulo: string; resumo: string; icone: NomeIcone; minutos: number; licoes: { titulo: string; texto: string }[]; perguntas: Pergunta[] };

export const MODULOS: Modulo[] = [
  {
    id: 'atendimento',
    titulo: 'Atendimento que encanta',
    resumo: 'Como receber, resolver reclamações e deixar o cliente com vontade de voltar.',
    icone: 'estrela',
    minutos: 3,
    licoes: [
      { titulo: 'Os primeiros 30 segundos', texto: 'Contato visual e um "já te atendo" quando você ainda não pode ir até a mesa fazem o cliente se sentir visto. Ninguém se incomoda de esperar um pouco; o que irrita é se sentir esquecido.' },
      { titulo: 'Conheça o cardápio', texto: 'Antes do turno, pergunte quais são os pratos e drinks da casa, o que está em falta e o que leva ingredientes que costumam causar alergia (glúten, lactose, castanhas, frutos do mar). Na dúvida, confirme com a cozinha: nunca chute.' },
      { titulo: 'Reclamação é oportunidade', texto: 'Ouça sem interromper, peça desculpas pelo incômodo (mesmo que a culpa não seja sua) e ofereça uma solução. Se não puder resolver, chame o responsável explicando a situação para o cliente não ter que repetir tudo.' },
      { titulo: 'Fechamento', texto: 'Traga a conta quando pedirem, confira os itens com o cliente e agradeça. Um "volte sempre" sincero e o seu QR Code de elogios no crachá podem render elogio e gorjeta.' },
    ],
    perguntas: [
      { texto: 'Um cliente reclama que o prato veio frio. Qual a melhor primeira atitude?', opcoes: ['Explicar que a cozinha está muito cheia hoje', 'Ouvir, pedir desculpas e oferecer trocar ou aquecer o prato', 'Chamar o gerente sem falar nada com o cliente', 'Dizer que vai ver e não voltar mais'] },
      { texto: 'Uma mesa nova chegou e você está ocupado com outra. O que fazer?', opcoes: ['Fingir que não viu até terminar', 'Fazer contato visual e avisar que já vai atender', 'Esperar que eles chamem', 'Pedir para a outra mesa aguardar'] },
      { texto: 'O cliente pergunta se um prato tem castanha porque é alérgico, e você não tem certeza.', opcoes: ['Dizer que não tem, para não perder a venda', 'Sugerir outro prato qualquer', 'Confirmar com a cozinha antes de responder', 'Dizer que é só tirar as castanhas por cima'] },
    ],
  },
  {
    id: 'higiene',
    titulo: 'Boas práticas com alimentos',
    resumo: 'O básico de higiene e temperatura que todo salão e cozinha esperam de você.',
    icone: 'escudo',
    minutos: 3,
    licoes: [
      { titulo: 'Mãos, cabelo e adornos', texto: 'Lave bem as mãos ao chegar, depois de ir ao banheiro, mexer em lixo, dinheiro ou celular. Cabelo preso e protegido na cozinha, unhas curtas e sem anéis, pulseiras ou relógio quando for manipular alimentos.' },
      { titulo: 'Temperatura é segurança', texto: 'Comida quente servida ou mantida no balcão deve ficar acima de 60 °C. Comida fria e perecível (saladas, sobremesas, frios) fica refrigerada abaixo de 5 °C. Entre essas temperaturas as bactérias se multiplicam rápido.' },
      { titulo: 'Contaminação cruzada', texto: 'Não use a mesma tábua ou faca para carne crua e alimentos prontos sem lavar antes. Guarde o cru abaixo do pronto na geladeira, para não pingar.' },
      { titulo: 'Se estiver doente', texto: 'Diarreia, vômito, febre ou feridas nas mãos: avise o responsável antes do turno. Trabalhar com alimentos assim coloca os clientes em risco.' },
    ],
    perguntas: [
      { texto: 'A comida quente pronta, no balcão ou no buffet, deve ficar mantida a:', opcoes: ['Acima de 60 °C', 'Entre 20 °C e 40 °C', 'Abaixo de 5 °C', 'Em temperatura ambiente'] },
      { texto: 'Alimentos refrigerados, como saladas e sobremesas, devem ficar:', opcoes: ['Entre 10 °C e 15 °C', 'Abaixo de 5 °C', 'Até 20 °C', 'Em temperatura ambiente'] },
      { texto: 'O que fazer antes de começar a manipular alimentos?', opcoes: ['Usar anel e relógio normalmente', 'Lavar bem as mãos, prender o cabelo e tirar adornos', 'Lavar as mãos só se estiverem sujas', 'Usar a mesma luva o turno inteiro'] },
    ],
  },
  {
    id: 'bebida',
    titulo: 'Bebida com responsabilidade',
    resumo: 'Menores, clientes alterados e quem vai dirigir: o que a lei e o bom senso pedem.',
    icone: 'cadeado',
    minutos: 2,
    licoes: [
      { titulo: 'Menor de 18 não bebe', texto: 'Vender, servir ou entregar bebida alcoólica para menores de 18 anos é crime (Estatuto da Criança e do Adolescente). Na dúvida, peça documento com foto. Sem documento, sem bebida alcoólica, por mais que a pessoa insista.' },
      { titulo: 'Cliente alterado', texto: 'Se alguém já está visivelmente embriagado, não sirva mais álcool. Recuse com educação, ofereça água ou algo para comer e avise o responsável. Evite discussão na frente de outros clientes.' },
      { titulo: 'Quem vai dirigir', texto: 'Se perceber que um cliente alcoolizado vai dirigir, avise o responsável e sugira táxi ou carro de aplicativo. Você não precisa resolver sozinho, mas não ignore.' },
    ],
    perguntas: [
      { texto: 'Um jovem sem documento pede uma cerveja e diz que tem 19 anos.', opcoes: ['Servir, já que ele disse a idade', 'Pedir documento com foto e só servir álcool se tiver 18 anos ou mais', 'Servir só uma', 'Perguntar ao amigo dele se é verdade'] },
      { texto: 'Um cliente visivelmente embriagado pede mais uma dose.', opcoes: ['Servir rápido para ele não reclamar', 'Recusar com educação, oferecer água e avisar o responsável', 'Servir uma dose dupla para ele ir embora', 'Discutir com ele no balcão'] },
      { texto: 'Você percebe que um cliente alcoolizado vai sair dirigindo.', opcoes: ['Não é problema seu', 'Avisar o responsável e sugerir táxi ou carro de aplicativo', 'Pegar a chave dele à força', 'Servir um café e liberar'] },
    ],
  },
  {
    id: 'seguranca',
    titulo: 'Segurança no turno',
    resumo: 'Quedas, fogo na cozinha e assédio: como agir e a quem recorrer.',
    icone: 'escudo',
    minutos: 2,
    licoes: [
      { titulo: 'Chão molhado derruba', texto: 'Caiu bebida ou gelo? Sinalize e seque na hora. Use calçado fechado e antiderrapante. Carregue a bandeja com peso perto do corpo e avise "atrás de você" ao passar por colegas.' },
      { titulo: 'Fogo na panela', texto: 'Nunca jogue água em óleo pegando fogo: ele espirra e o fogo aumenta. Desligue o fogo e abafe com uma tampa ou pano úmido. Saiba onde ficam o extintor e as saídas antes do turno começar.' },
      { titulo: 'Assédio não faz parte do trabalho', texto: 'Comentários, toques ou convites indesejados de clientes ou colegas não são "normais". Afaste-se, avise o responsável e, se quiser, registre pelo Vora em Denunciar, no perfil da pessoa ou do estabelecimento. Você também pode bloquear.' },
    ],
    perguntas: [
      { texto: 'Caiu bebida no chão do salão em horário de movimento.', opcoes: ['Esperar o fim do turno para limpar', 'Sinalizar e secar na hora', 'Avisar só se alguém escorregar', 'Jogar guardanapos por cima'] },
      { texto: 'Uma panela com óleo pegou fogo na cozinha.', opcoes: ['Jogar água rapidamente', 'Desligar o fogo e abafar com uma tampa', 'Abanar para apagar', 'Levar a panela correndo para fora'] },
      { texto: 'Um cliente faz comentários e insinuações que te incomodam.', opcoes: ['Aguentar calado para não perder o turno', 'Avisar o responsável e, se quiser, registrar pelo Vora', 'Responder no mesmo tom', 'Ignorar e torcer para parar'] },
    ],
  },
];

export const moduloPorId = (id: string) => MODULOS.find((m) => m.id === id);
