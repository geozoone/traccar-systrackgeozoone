function bloaqueio(unid) {
    // swal({ icon: "/public/spinner.gif", button: false });

    let temp = {};
    temp.deviceId = unid;

    swal({
        title: "Enviar Comando",
        text: "O que deseja fazer?",
        buttons: {
            desbloquear: {
                text: "Desbloquear",
                value: "desbloquear"
            },
            bloequer: {
                text: "Bloquear",
                value: "bloequer",
            },
            cancel: "Cancelar",
            defeat: false,
        },
    }).then((value) => {
        switch (value) {
            case "desbloquear":
                swal({ icon: "/public/spinner.gif", button: false });

                temp.type = 'engineResume';

                axios.post('/api/commands/send', temp)
                    .then(function (res) {
                        switch (res.data.id) {
                            case 0:
                                swal("Comando Enviado com Sucesso", {
                                    icon: "success"
                                });
                                break;

                            default:
                                swal("Algo de errado Check console log", {
                                    icon: "warning"
                                });
                                console.log(res.data);
                                break;
                        }

                        console.log(res.data);
                    })
                    .catch(function (error) {
                        console.error(error);
                    }); break;
                break;

            case "bloequer":
                swal({ icon: "/public/spinner.gif", button: false });

                temp.type = 'engineStop';

                axios.post('/api/commands/send', temp)
                    .then(function (res) {
                        switch (res.data.id) {
                            case 0:
                                swal("Comando Enviado com Sucesso", {
                                    icon: "success"
                                });
                                break;

                            default:
                                swal("Algo de errado Check console log", {
                                    icon: "warning"
                                });
                                console.log(res.data);
                                break;
                        }
                        console.log(res.data);
                    })
                    .catch(function (error) {
                        console.error(error);
                    }); break;

        }
    });
}

//
function converterData(data) {
    // Dividir a data em partes separadas
    var partes = data.split('-');

    // Extrair ano, mês e dia
    var ano = partes[0];
    var mes = partes[1];
    var dia = partes[2];

    // Formatar a data para D/M/YYYY
    var dataFormatada = dia + '/' + mes + '/' + ano;

    return dataFormatada;
}

//
function formatarNumero(valor) {
    // Arredonda o número para duas casas decimais
    const numeroFormatado = parseFloat(valor).toFixed(2);

    // Substitui o ponto por vírgula e adiciona separador de milhares, se houver
    return numeroFormatado.replace('.', ',').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
}

//
function formatarNumeroInverso(valor) {
    // Remove os pontos de milhares e substitui a vírgula por ponto
    const numeroFormatado = valor.replace(/\./g, '').replace(',', '.');

    return numeroFormatado;
}