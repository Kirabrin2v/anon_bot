import json

fp = open("questions.txt", encoding="utf-8").readlines()

dictionary = {}
for string in fp:
    print(type(string), string)
    key = string.split(" |")[0]
    value = string.split("|")[1].split()[1]
    dictionary[key] = value.replace("\n", "")

print(dictionary, len(dictionary.keys()))

open("questions.json", "w", encoding="utf-8").write(json.dumps(dictionary, ensure_ascii=False, indent=0))
