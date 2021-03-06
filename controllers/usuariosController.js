const { validationResult } = require('express-validator');
const db = require('../database/models')
const bcrypt = require('bcryptjs');

module.exports = {
    registro: (req, res) => {
        return res.render('register')
    },
    processRegister: (req, res) => {


        const { first_name, last_name, email, password } = req.body;

        let errores = validationResult(req);


        db.User.findAll({
            where: {
                email
            }
        }).then(userExist => {

            if (userExist.length > 0) {
                errores = errores.mapped();
                errores = {
                    ...errores,
                    email: {
                        msg: "Dirección de correo ya registrado"
                    }
                }
                return res.render("register", {
                    errores: errores,
                    old: req.body,
                })
            } else {
                if (errores.isEmpty()) {



                    db.User.create({
                        firstName: first_name.trim(),
                        lastName: last_name.trim(),
                        email: email.trim(),
                        password: bcrypt.hashSync(password, 10),
                        image: req.file ? req.file.filename : 'default.png',
                        roleId: 1
                    }).then(usuario => {

                        req.session.loginUsuario = {
                            id: usuario.id,
                            firstName: usuario.firstName,
                            lastName: usuario.lastName,
                            email: usuario.email,
                            rol: usuario.roleId,
                            image: usuario.image
                        }

                        return res.redirect('/users/perfil')
                    }).catch(error => console.log(error))


                } else {
                    errores = errores.mapped();

                    if (req.fileValidationError) {
                        errores = {
                            ...errores,
                            image: {
                                msg: req.fileValidationError
                            }
                        }
                    }
                    // return res.send(errores)
                    return res.render('register', {
                        errores: errores,
                        old: req.body
                    })
                }
            }

        })



    },
    login: (req, res) => {
        return res.render('login')
    },
    processLogin: (req, res) => {

        const errores = validationResult(req)

        db.User.findOne({ where: { email: req.body.email } })
            .then(usuario => {

                if (errores.isEmpty()) {
                    // let usuario = usuarios.find(usuario => usuario.email === req.body.email);

                    if (!usuario || !bcrypt.compareSync(req.body.password, usuario.password)) {
                        return res.render("login", {
                            errores: {
                                email: {
                                    msg: "Credenciales inválidas"
                                }
                            }

                        })

                    } else {
                        req.session.loginUsuario = {
                            id: usuario.id,
                            firstName: usuario.firstName,
                            lastName: usuario.lastName,
                            email: usuario.email,
                            rol: usuario.roleId,
                            image: usuario.image
                        }

                        if (req.body.remember) {
                            res.cookie('lazloCookie', req.session.loginUsuario, { maxAge: 2000 * 60 });
                            console.log("req.usuarios- " + req.session.loginUsuario)
                        }

                        /* CARRITO */
                        req.session.carrito = [];
                        db.Order.findOne({
                            where: {
                                userId: req.session.loginUsuario.id,
                                status: 'pending'
                            },
                            include: [
                                {
                                    association: 'carts',
                                    include: [
                                        {
                                            association: 'product',
                                            include: ['category', 'images']
                                        }
                                    ]
                                }
                            ]
                        }).then(order => {
                            if (order) {
                                order.carts.forEach(item => {
                                    let product = {
                                        id: item.productId,
                                        nombre: item.product.name,
                                        image: item.product.images[0].file,
                                        precio: +item.product.price,
                                        categoria: item.product.category.name,
                                        cantidad: +item.quantity,
                                        total: item.product.price * item.quantity,
                                        orderId: order.id
                                    }
                                    req.session.carrito.push(product)
                                });
                            }
                            if (req.session.loginUsuario.rol === 2) {
                                return res.redirect('/users/perfilAdmin')
                            } else {
                                return res.redirect('/users/perfil')
                            }
                        })
                    }



                } else {
                    //return res.send(errores.mapped())
                    return res.render('login', {
                        errores: errores.mapped(),
                        old: req.body
                    })
                }
            }).catch(
                error => console.log(error)
            )
    },

    perfil: (req, res) => {

        db.User.findByPk(req.session.loginUsuario.id)
            .then(usuario => {
                return res.render('perfil',
                    { usuario })
            })

    },
    logout: (req, res) => {
        req.session.destroy();
        res.redirect('/');
    },

    perfilAdmin: (req, res) => {


        let usuarios = db.User.findAll();

        let roles = db.Role.findAll({
            include: [
                'users'
            ]
        });

        let usuario = db.User.findByPk(req.session.loginUsuario.id, {
            include: [
                'role'
            ]
        })

        Promise.all(([usuarios, roles, usuario]))
            .then(([usuarios, roles, usuario]) => {
                //res.send(usuario)
                res.render('perfilAdmin', {
                    usuario,
                    usuarios,
                    roles
                })
            }).catch(error => console.log(error))


    },
    cambiarRol: (req, res) => {

        db.User.findByPk(req.params.id).then(usuario => {
            //res.send(usuario)
            db.User.update({
                roleId: req.body.rol,
            }, {
                where: {
                    id: usuario.id
                }
            }).then(usuarioA => {
                return res.redirect('/users/perfilAdmin')
            }).catch(error => console.log(error))
        }).catch(error => console.log(error))

    },

    editarPerfil: (req, res) => {
        db.User.findByPk(req.session.loginUsuario.id)
            .then(usuario => {
                return res.render('editarPerfil', {
                    usuario
                })
            }).catch(error => console.log(error))
    },

    processEditarPerfil: (req, res) => {

        let errores = validationResult(req);

        const { firstName, lastName, newPassword, password } = req.body;

        db.User.findByPk(req.params.id)
            .then((usuario) => {
                let passwordCheck = bcrypt.compareSync(password, usuario.password);

                if (errores.isEmpty()) {
                    errores = errores.mapped()
                    if (!passwordCheck) {
                        errores = {
                            ...errores,
                            password: {
                                msg: "Credenciales invalidas"
                            }
                        }

                        return res.render('editarPerfil', {
                            errores,
                            usuario
                        })
                    } else {
                        if (!newPassword) {
                            db.User.update(
                                {
                                    firstName: firstName,
                                    lastName: lastName,
                                    image: req.file ? req.file.filename : usuario.image,
                                }, {
                                where: {
                                    id: req.params.id
                                }
                            }).then(() => {

                                if (req.session.loginUsuario.rol === 2) {
                                    return res.redirect('/users/perfilAdmin')
                                } else {
                                    return res.redirect('/users/perfil')
                                }

                            }).catch(error => res.send(error))
                        } else {
                            db.User.update(
                                {
                                    firstName: firstName,
                                    lastName: lastName,
                                    password: bcrypt.hashSync(newPassword, 10),
                                    image: req.file ? req.file.filename : usuario.image,
                                }, {
                                where: {
                                    id: req.params.id
                                }
                            }).then(() => {

                                if (req.session.loginUsuario.rol === 2) {
                                    return res.redirect('/users/perfilAdmin')
                                } else {
                                    return res.redirect('/users/perfil')
                                }

                            }).catch(error => res.send(error))
                        }

                        delete req.session.loginUsuario;

                        req.session.loginUsuario = {
                            id: usuario.id,
                            firstName,
                            lastName,
                            email: usuario.email,
                            rol: usuario.roleId,
                            image: req.file ? req.file.filename : usuario.image,
                        }
                    }
                } else {
                    errores = errores.mapped();

                    if (req.fileValidationError) {
                        errores = {
                            ...errores,
                            image: {
                                msg: req.fileValidationError
                            }
                        }
                    }

                    return res.render('editarPerfil', {
                        errores: errores,
                        usuario,
                    })
                }

            }).catch(error => res.send(error))

        /*let errores = validationResult(req);

        const { firstName, lastName, newPassword, oldPassword } = req.body;

        db.User.findByPk(req.params.id)
            .then(usuario => {
                if (errores.isEmpty()) {
                    if (bcrypt.compareSync(oldPassword, usuario.password)) {
                        let contraHash;

                        if (newPassword) {
                            contraHash = bcrypt.hashSync(newPassword, 10)

                        } else {
                            contraHash = bcrypt.hashSync(oldPassword, 10)
                        }

                        db.User.update(
                            {
                                firstName: firstName,
                                lastName: lastName,
                                password: contraHash,
                                image: req.file ? req.file.filename : usuario.image,
                            }, {
                            where: {
                                id: req.params.id
                            }
                        }

                        ).then(() => {

                            delete req.session.loginUsuario;

                            req.session.loginUsuario = {
                                id: usuario.id,
                                firstName,
                                lastName,
                                email: usuario.email,
                                rol: usuario.roleId,
                                image: req.file ? req.file.filename : usuario.image,
                            }

                            if (req.session.loginUsuario.rol === 2) {
                                return res.redirect('/users/perfilAdmin')
                            } else {
                                return res.redirect('/users/perfil')
                            }

                        }).catch(error => res.send(error))
                    }
                } else {

                    errores = errores.mapped();

                    if (req.fileValidationError) {
                        errores = {
                            ...errores,
                            image: {
                                msg: req.fileValidationError
                            }
                        }
                    }

                    return res.render('editarPerfil', {
                        errores: errores,
                        errores: {
                            password: "contraseña incorrecta",
                            ...errores,
                        }, 
                        usuario,
                        old: req.body
                    })
                }
            }).catch(error => console.log(error))*/
    }
}
