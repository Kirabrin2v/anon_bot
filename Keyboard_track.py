from flask import Flask
from flask_socketio import SocketIO
import keyboard
from pynput import mouse
import configparser
config = configparser.ConfigParser()
config.read('txt/settings.ini', encoding="UTF-8") 
port = config["VARIABLES"]["port_keyboard_event"]


app = Flask(__name__)

import time
timer = 0
previous_x, previous_y = 0, 0

socketio = SocketIO(app)
print("Test python")
@socketio.on('connect')
def handle_connect():
    print('Client connected')

def on_key_event(event):
    if event.name == "unknown": return

    print({'key': event.name, "is_pressed": event.event_type})
    socketio.emit('key_event', {"type_device": "keyboard", "key": event.name, "type_click": event.event_type})

def on_move(x, y):
    global previous_x, previous_y, timer
    if (time.time() - timer > 0.1):
        timer = time.time()
        delta_x = x - previous_x
        delta_y = y - previous_y
        previous_x, previous_y = x, y
        socketio.emit('key_event', {"type_device": "mouse", "is_move": True, "delta_x": delta_x, "delta_y": delta_y})
        print(f"Relative move: ({delta_x}, {delta_y})")

def on_click(x, y, button, pressed):
    print({"type_device": "mouse", "button": button.value, "pos": (x, y), "is_pressed": pressed})
    socketio.emit('key_event', {"type_device": "mouse", "button": button.value, "pos": (x, y), "is_pressed": pressed})

def on_scroll(x, y, dx, dy):
    print({"type_device": "mouse", "pos": (x, y), "direction": {"x": dx, "y": dy}})
    socketio.emit('key_event', {"type_device": "mouse", "is_scroll": True, "pos": (x, y), "direction": {"x": dx, "y": dy}})


keyboard.hook(on_key_event)  # Подключаем обработчик событий клавиатуры

import threading
def start_mouse_listener():
    with mouse.Listener(on_click=on_click, on_scroll=on_scroll, on_move=on_move) as listener:
        listener.join()
mouse_thread = threading.Thread(target=start_mouse_listener)
mouse_thread.start()

socketio.run(app, "localhost", port, allow_unsafe_werkzeug=True)
    
   

