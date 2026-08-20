const MAIL_KNOWLEDGE = {
  parques: {
    'aquopolis torrevieja': {
      aliases: ['torrevieja', 'aq torrevieja', 'aquopolis torrevieja'],
      facts: [
        'Si quiere volver otro día, en taquillas serían 17€.',
        'Los productos de interior se pagan con tarjeta.',
        'El parking se paga con tarjeta.',
        'Solo se vende online el Speedy Pass Premium.',
        'Las entradas no son nominativas.',
        'Si compra la entrada online se ahorra la cola de compra en taquilla.',
        'No se alquilan flotadores; van incluidos solo en atracciones específicas.',
        'Las tumbonas no están incluidas con la entrada.',
        'No puede acceder con tumbonas ni sillas de playa.',
        'No se puede hacer devolución, aunque en algunos casos sí se puede gestionar cambio.',
        'Las personas con discapacidad se valoran en el parque para posible Speedy Pass; el acompañante debe ser mayor de edad.',
        'Los manguitos están prohibidos en atracciones de despegue.',
        'Se fuma solo en las zonas habilitadas.'
      ]
    },
    'aquopolis cullera': {
      aliases: ['cullera', 'aq cullera', 'aquopolis cullera'],
      facts: [
        'Si quiere volver otro día, en taquillas serían 17€.',
        'El parking en Cullera cuesta 7€ y se paga con tarjeta.',
        'Los productos de interior se pagan con tarjeta.',
        'Solo se vende online el Speedy Pass Premium.',
        'Las entradas no son nominativas.',
        'Si compra la entrada online se ahorra la cola de compra en taquilla.',
        'No puede acceder con tumbonas ni sillas de playa.',
        'No se puede hacer devolución, aunque en algunos casos sí se puede gestionar cambio.',
        'Las personas con discapacidad se valoran en el parque para posible Speedy Pass.',
        'Los manguitos están prohibidos en atracciones de despegue.',
        'Se fuma solo en las zonas habilitadas.'
      ]
    },
    'aquopolis costa dorada': {
      aliases: ['costa dorada', 'aq costa dorada', 'aquopolis costa dorada'],
      facts: [
        'La persona con discapacidad debe pasar por atención al cliente para la entrada del acompañante gratuito.',
        'Lo mismo aplica a familia numerosa o monoparental, siempre con acreditación.',
        'La persona con discapacidad y su acompañante disponen de Speedy Pass de 8 usos.',
        'Solo hay entradas con fecha cerrada.',
        'El All Inclusive tiene un cooldown de 1 hora.',
        'Los viernes puede haber limitación de parking por mercadillo.',
        'Pueden salir y volver a entrar avisando en acceso para que les pongan pulsera.',
        'Se puede pasar comida salvo cuchillos, latas o cristal.',
        'Manguitos solo en zona infantil; en el resto se facilitan chalecos.',
        'No disponen de alquiler de carritos, pero sí pueden entrar con el suyo.',
        'No disponen de cajeros ni máquina de secado.',
        'No se devuelve el dinero si llueve.',
        'No se venden toallas.',
        'Disponen de zona de picnic.',
        'Las sombrillas no pueden acceder, pero las sillas de playa sí.',
        'Menores de 1 metro no pagan.',
        'Se puede pagar en metálico y tarjeta.'
      ]
    },
    'aquopolis cartaya': {
      aliases: ['cartaya', 'aquopolis cartaya'],
      facts: [
        'El parking cuesta 4€ y se puede pagar en efectivo o tarjeta.',
        'Los flotadores de alquiler cuestan 6€ el individual y 10€ el doble.',
        'El Speedy Pass cambia de precio según el día.',
        'Se puede meter comida y comer en las zonas señalizadas.',
        'El acompañante de una persona con discapacidad debe ser mayor de edad.',
        'Se puede conceder Speedy Pass a persona con discapacidad y acompañante si acredita 33% o más con movilidad reducida o discapacidad intelectual.',
        'Se puede meter mobiliario de playa menos sombrillas y solo en zonas indicadas.',
        'No tienen cajeros ni máquina de secado.',
        'Tienen sillas anfibias para adultos y pediátricas.',
        'Hay cargador de coches eléctricos en el parking del parque.',
        'No cierran el parque si llueve.',
        'No pueden entrar mascotas salvo perros guía o de apoyo emocional.',
        'Disponen de flotadores gratis para las atracciones que lo necesiten y también de alquiler.',
        'No se venden toallas.'
      ]
    },
    'aquopolis villanueva de la canada': {
      aliases: ['villanueva de la canada', 'villanueva de la cañada', 'aquopolis villanueva de la canada', 'aquopolis villanueva de la cañada', 'aquopolis vil', 'vil'],
      facts: [
        'En Aquópolis Villanueva de la Cañada no tienen cargadores de coche.',
        'Las taquillas cuestan 8€.',
        'Si tiene entrada reducida, pagando la diferencia en taquillas puede pasar.'
      ]
    },
    'selwo marina': {
      aliases: ['selwo marina', 'marina'],
      facts: [
        'Está cerca del castillo y del parque de la Paloma.',
        'No tiene delfines.',
        'No se puede tocar ningún animal.',
        'Dentro de la experiencia VIP está el encuentro con pingüinos.',
        'La visita suele durar entre 2:30 y 3:00.',
        'Las personas con carrito no tienen problema.',
        'Se puede meter comida, pero se debe comer en bancos o gradas; neveritas grandes no dejan.',
        'El todo incluido de Selwo Marina funciona cada 30 minutos.'
      ]
    },
    'teleferico benalmadena': {
      aliases: ['teleferico', 'teleférico', 'teleferico benalmadena', 'teleférico benalmádena'],
      facts: [
        'Los empadronados pueden solicitar invitación para últimos sábados y domingos de cada mes escribiendo una semana antes a diadelempadronado@innoben.es.',
        'Solo aplica para 4 personas.',
        'Tiene audioguía durante el recorrido.',
        'La actividad de aves no está incluida.',
        'No tienen datáfonos por cobertura.',
        'Solo hay entradas general niño y adulto.',
        'No se puede consumir dentro de las cabinas.'
      ]
    },
    'selwo aventura': {
      aliases: ['selwo aventura', 'aventura'],
      facts: [
        'Las actividades multiaventura se contratan en taquillas.',
        'Tiro con arco cuesta 3€ con 6 flechas.',
        'Jumping cuesta 5€.',
        'Tirolina cuesta 7€.',
        'Las personas con carrito no tienen problema.',
        'Se recomienda llegar 1:30 antes del inicio de la actividad.',
        'El safari lo pueden hacer menores de 3 años gratis.',
        'Aunque no contrates safari, puedes ver todos los animales igualmente, aunque algunos desde más distancia.',
        'La visita VIP empieza a las 10:00 y la reserva es solo online.',
        'La visita VIP incluye safari y almuerzo.',
        'Los empadronados en Estepona tienen entrada gratuita con su código del ayuntamiento.',
        'El safari suele empezar sobre las 11:00 o 12:00.',
        'No se permiten animales en el parque.'
      ]
    },
    'hotel selwo': {
      aliases: ['hotel selwo', 'poblado masai', 'poblado watu', 'poblado zulu', 'poblado zulú'],
      facts: [
        'Masai es la opción más económica, en la parte baja, con capacidad máxima 3 personas y un bebé, y sin wifi.',
        'Watu es la opción intermedia, en la parte alta, con capacidad máxima 4 personas y un bebé, con transfer 24h y sin wifi.',
        'Zulú es la opción más alta, con capacidad máxima 6 personas y 2 bebés, con wifi.',
        'Se puede cambiar cama supletoria por cuna.',
        'El precio incluye alojamiento, desayuno, entradas al parque para todos los días alojados, parking y safari.',
        'El safari se hace el día posterior a la llegada, aunque en algunos casos se podría cambiar en recepción por 5€ por persona.',
        'La cena es mejor contratarla online con la reserva y cuesta 15€ por persona.',
        'En autor de la reserva debéis marcaros vosotros, origen call center y confirmación autor de la reserva.',
        'Si fuese un bonista, en empresa hay que poner SELWO BONISTAS.',
        'Una vez hecha la reserva hay que llevar control y apuntarla en el Excel de venta hoteles.',
        'Si está pagada, hay que mandar la confirmación al correo del cliente y apuntarlo en el Excel.'
      ]
    },
    'parque warner': {
      aliases: ['parque warner', 'warner'],
      facts: [
        'Sí se puede entrar con paraguas.',
        'Se puede acceder con carrito de bebé o niño sin problema.',
        'No se puede meter comida, salvo comida de bebé como potitos, biberón con cereales o papilla de fruta.',
        'Las gestiones relacionadas con bonos para Parque Warner se pueden tramitar directamente a través de nuestro centro de atención al cliente. Deberá facilitarnos el número de bono y los datos del titular para poder ayudarle.',
        'Los extras comprados para otro día se pueden usar pasando por información.',
        'Los objetos perdidos se gestionan por admisiones@parquewarner.com.',
        'Los temas de tiendas o merchandising se gestionan por MerchandisingPW@parquewarner.com.',
        'Si hay entradas de 2 días, hay que mandar correo a error entradas.'
      ]
    },
    'warner beach': {
      aliases: ['warner beach', 'wab'],
      facts: [
        'No se da pase rápido por el tema de las escaleras de las atracciones.',
        'En el bono verano plus se incluye hasta el 31/08/2026.'
      ]
    },
    'faunia': {
      aliases: ['faunia'],
      facts: [
        'Los veterinarios no tienen descuento en Faunia.'
      ]
    },
    'zoo': {
      aliases: ['zoo', 'zoo + faunia'],
      facts: [
        'En la entrada combinada Zoo + Faunia, el primer día es para Zoo y Faunia se puede usar cualquier otro día hasta final de temporada.'
      ]
    }
  },
  notes: [
    'Si las entradas están compradas en la web oficial, pueden ir otro día antes o después verificándolas y abonando la diferencia si corresponde.',
    'Si da fallo con el pago, mejor que no use el autocompletado.',
    'Todas las actividades de Selwo duran entre 30 y 40 minutos.',
    'Si son entradas de 2 días, mandar correo a error entradas.',
    'Para entradas de tarde de PAM con fecha equivocada, tienen que comprar una nueva y enviar ambas compras a consultaentrada@grpr.com para tramitar devolución de las erróneas; solo si compró en la web oficial.',
    'No se puede ampliar de bono verano a bono anual.',
    'Si tiene entrada reducida, pagando la diferencia en taquillas puede pasar.',
    'Todos los cumpleaños van siempre a reservas, aunque sean solo entradas.',
    'Los pases rápidos son de parque único.',
    'Las reservas deben hacerse con al menos 10 días de antelación.',
    'En Aquópolis Villanueva de la Cañada no tienen cargadores de coche.',
    'Las taquillas de Villanueva de la Cañada cuestan 8€.',
    'Las gestiones de bonos de Parque Warner sí se pueden tramitar desde atención al cliente facilitando el número de bono y los datos del titular.',
    'Los números de socio de bonos empiezan por 7 u 8.',
    'Con bono verano ultra + beach, Villanueva lleva 12% y Beach 18%.',
    'En Warner Beach no dan pase rápido por el tema de las escaleras de las atracciones.',
    'Los veterinarios no tienen descuento en Faunia.',
    'La entrada Zoo + Faunia se usa primer día Zoo y Faunia cualquier otro día hasta fin de temporada.',
    'proveedores@grpr.com es para temas de proveedores.'
  ],
  templates: {
    saludo: {
      formal: 'Hola, buenos días, soy Javier. Le comento sobre lo que me dice:',
      neutro: 'Hola, buenos días:',
      cercano: 'Hola, ¿qué tal? Te comento:'
    },
    cierre: {
      formal: 'Un saludo.',
      amable: 'Espero haberle ayudado. Un saludo.',
      disponible: 'Si necesita algo más, quedo a su disposición. Un saludo.'
    },
    disculpa: 'Perdona que su experiencia haya sido así durante la visita. Lo sentimos de verdad y trasladamos sus comentarios para seguir mejorando.',
    quejaConsultaEntrada: 'Te recomiendo pasarlo a consulta entrada, ya que las quejas y reclamaciones no las llevamos nosotros directamente. Si el caso viene de una compra web y corresponde, puedes indicarle que lo remita a consultaentrada@grpr.com con todos los datos y el máximo detalle posible.',
    derivacion: 'Hemos derivado su caso al departamento correspondiente. En caso de disponer de más información, se pondrán en contacto con usted.',
    newsletter: 'Desde aquí no podemos revisar directamente el estado de la newsletter. Le recomiendo revisar también promociones, spam o correo no deseado, ya que además el envío no suele ser instantáneo y puede tardar alrededor de un día.',
  },
  exampleReplies: [
    {
      topic: 'hotel selwo',
      text: 'La entrada al parque incluye todos los días alojados, además del desayuno, parking y safari. El safari se realiza normalmente el día posterior a la llegada. El check-in y la salida pueden depender de la reserva concreta, pero si me indica fecha y alojamiento le ayudo a revisarlo mejor.'
    },
    {
      topic: 'objetos perdidos parque warner',
      text: 'Para objetos perdidos de Parque Warner, puede escribir a admisiones@parquewarner.com indicando el máximo detalle posible sobre el objeto y la fecha de la visita.'
    }
  ]
};

const EMAIL_PHRASES = {
  saludos: [
    'Hola, buenos días, soy Javier. Le comento sobre lo que me dice:',
    'Hola, buenas tardes, soy Javier. Le comento sobre lo que me dice:',
    'Hola, buenos días:',
  ],
  cierres: [
    'Un saludo.',
    'Espero haberle ayudado. Un saludo.',
    'Si necesita algo más, quedo a su disposición. Un saludo.',
  ],
  seguimiento: [
    'Si me indica la fecha exacta de visita, se lo confirmo mejor.',
    'Si me especifica el día que quieren ir, le puedo facilitar mejor la gestión.',
    'Si quiere, le dejo la gestión preparada en cuanto me confirme esos datos.',
  ],
  disculpas: [
    'Sentimos mucho las molestias ocasionadas.',
    'Perdona que su experiencia haya sido de esa manera durante la visita.',
    'Lo siento de verdad y esperamos que no vuelva a ocurrir.',
  ],
  derivaciones: [
    'Hemos derivado su caso al departamento correspondiente.',
    'Este caso debe revisarlo el departamento correspondiente.',
    'En caso de disponer de más información, se pondrán en contacto con usted.',
  ]
};
