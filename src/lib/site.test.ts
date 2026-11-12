import assert from "node:assert/strict";
import { test } from "node:test";

import { INTERESTS, cleanWhatsapp, contactLink, defaultContact, familyMessage, formatWhatsapp, isValidEmail, isValidWhatsapp, mailtoLink, whatsappLink } from "./site.ts";

test("el enlace de WhatsApp lleva el número limpio y el mensaje codificado", () => {
  const link = whatsappLink("+54 9 2324 58-2614", "Hola, ¿cómo va? 100%");
  assert.equal(link, "https://wa.me/5492324582614?text=Hola%2C%20%C2%BFc%C3%B3mo%20va%3F%20100%25");
  assert.equal(decodeURIComponent(link.split("text=")[1]), "Hola, ¿cómo va? 100%");
});

test("sin número, WhatsApp deja elegir el contacto", () => {
  assert.equal(whatsappLink(null, "Hola"), "https://wa.me/?text=Hola");
});

test("el email abre con asunto y texto", () => {
  const link = mailtoLink("a@b.com", "Consulta & más", "Línea 1\nLínea 2");
  assert.equal(link, "mailto:a@b.com?subject=Consulta%20%26%20m%C3%A1s&body=L%C3%ADnea%201%0AL%C3%ADnea%202");
});

test("cada interés tiene su mensaje, y los tres del pedido están tal cual", () => {
  assert.equal(INTERESTS.configurador.message, "Hola, quiero consultar por la implementación de un configurador 3D para mi empresa.");
  assert.equal(INTERESTS.web.message, "Hola, me interesa contratar una página web profesional y quería conocer las opciones.");
  assert.equal(INTERESTS["web-configurador"].message, "Hola, quiero una página web con configuradores de productos integrados.");
  assert.match(INTERESTS.demo.message, /estuve probando MEDIDA y me interesa tener un configurador de este estilo para mi empresa/);
  const messages = Object.values(INTERESTS).map((i) => i.message);
  assert.equal(new Set(messages).size, messages.length, "dos intereses comparten mensaje");
});

test("el contacto comercial usa el canal y el interés pedidos", () => {
  const contact = { whatsapp: "5491100000000", email: "ventas@ejemplo.com" };
  assert.ok(contactLink(contact, "whatsapp", "plataforma").startsWith("https://wa.me/5491100000000?text="));
  const mail = contactLink(contact, "email", "web");
  assert.ok(mail.startsWith("mailto:ventas@ejemplo.com?subject="));
  assert.ok(decodeURIComponent(mail).includes(INTERESTS.web.message));
  const custom = contactLink(contact, "whatsapp", "configurador", familyMessage("Mesas y escritorios"));
  assert.ok(decodeURIComponent(custom).includes("configurador de mesas y escritorios"));
});

test("el número de partida es un WhatsApp válido y se muestra legible", () => {
  assert.ok(isValidWhatsapp(defaultContact.whatsapp));
  assert.ok(isValidEmail(defaultContact.email));
  assert.equal(formatWhatsapp("5492324582614"), "+54 9 2324 58-2614");
  assert.equal(formatWhatsapp("34600111222"), "+34600111222");
});

test("no se acepta cualquier cosa como número o como email", () => {
  for (const bad of ["", "123", "0111555000", "abc", "1".repeat(16)]) assert.equal(isValidWhatsapp(bad), false, bad);
  assert.equal(cleanWhatsapp("(011) 15-5555-0000"), "0111555550000");
  for (const bad of ["", "a@b", "a b@c.com", "@c.com", `${"a".repeat(250)}@b.com`]) assert.equal(isValidEmail(bad), false, bad);
});
